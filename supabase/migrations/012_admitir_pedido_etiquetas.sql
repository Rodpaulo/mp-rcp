-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 012 · correcção de admitir_pedido
-- Ver SPEC.md, secção 16.15. Correr uma vez no SQL Editor do Supabase,
-- depois da 011.
-- Corrige o erro 22P02 (malformed array literal "associado") ao admitir um
-- pedido cujo contacto já existe: a 011 fazia etiquetas || 'associado', e o
-- Postgres lia o texto como um array. Agora:
--   - contacto novo: etiquetas = array['associado'];
--   - contacto existente: acrescenta 'associado' só se ainda lá não estiver.
-- Substitui só a função admitir_pedido (create or replace), criada pela 011 e
-- ainda sem uso no código em produção. Mesma assinatura e mesmo comportamento
-- em tudo o resto. Não toca em tabelas, vistas, políticas nem noutras funções.
-- Tudo dentro de uma transacção: ou corre inteira, ou não fica nada.
-- =====================================================================

begin;

-- Admite um pedido pago, numa só operação:
--   1. liga ou cria o contacto do Rede, se o pedido ainda não tiver;
--   2. cria o associado (número seguinte da sequência; fundador se o pagamento
--      foi até 31/12/2026);
--   3. cria a quota paga: a de 2027 para quem é admitido até 31/12/2027,
--      a do ano da admissão a partir de 2028; valor da configuração;
--   4. passa o pedido a 'admitido'.
-- O email 9 ou 10 não se grava aqui: sai na passagem seguinte da função
-- diária, que envia a quem foi admitido e ainda não o recebeu (SPEC 16.8).
-- security invoker: corre com as permissões de quem chama (RLS da direcção).

create or replace function public.admitir_pedido(p_pedido_id uuid, p_tipo text default 'efectivo')
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pedido      public.pedidos_adesao%rowtype;
  v_contacto_id uuid;
  v_person_id   uuid;
  v_hoje        date := (now() at time zone 'Europe/Brussels')::date;
  v_ano_quota   integer;
  v_valor_texto text;
  v_valor       numeric(8, 2);
  v_fundador    boolean;
  v_perfil      uuid;
  v_associado   public.associados%rowtype;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'Acesso reservado à direcção.';
  end if;

  if p_tipo not in ('efectivo', 'aderente') then
    raise exception 'Tipo de associado desconhecido: %.', p_tipo;
  end if;

  select * into v_pedido from public.pedidos_adesao where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_pedido.estado <> 'pago' or v_pedido.data_pagamento is null then
    raise exception 'Só se admite um pedido com o pagamento confirmado.';
  end if;

  -- Quota: 2027 até ao fim do primeiro exercício; depois, o ano da admissão.
  v_ano_quota := greatest(2027, extract(year from v_hoje)::integer);
  select valor into v_valor_texto from public.configuracao where chave = 'valor_quota_' || v_ano_quota;
  if v_valor_texto is null or trim(v_valor_texto) = '' then
    raise exception 'Falta o valor da quota de % na configuração (valor_quota_%).', v_ano_quota, v_ano_quota;
  end if;
  v_valor := replace(trim(v_valor_texto), ',', '.')::numeric;

  -- Contacto: o do pedido; senão, uma pessoa com o mesmo email; senão, um novo.
  v_contacto_id := v_pedido.contacto_id;
  if v_contacto_id is null then
    select id into v_contacto_id from public.contactos
     where tipo_registo = 'pessoa' and email = v_pedido.email
     order by created_at limit 1;
  end if;
  if v_contacto_id is null then
    select id into v_person_id from public.people where email = v_pedido.email;
    insert into public.contactos (tipo_registo, nome, email, etiquetas, pedido_adesao_em, person_id, estado, origem)
    values ('pessoa', v_pedido.nome_completo, v_pedido.email, array['associado']::text[],
            (v_pedido.data_pedido at time zone 'Europe/Brussels')::date, v_person_id, 'a_avaliar',
            'Pedido de adesão (Tally)')
    returning id into v_contacto_id;
  else
    update public.contactos
       -- array_append: 'associado' entra como elemento, só se ainda não estiver na lista.
       set etiquetas        = case when 'associado' = any (etiquetas) then etiquetas
                                   else array_append(etiquetas, 'associado'::text) end,
           pedido_adesao_em = coalesce(pedido_adesao_em, (v_pedido.data_pedido at time zone 'Europe/Brussels')::date),
           updated_at       = now()
     where id = v_contacto_id;
  end if;

  if exists (select 1 from public.associados where contacto_id = v_contacto_id) then
    raise exception 'Este contacto já é associado.';
  end if;

  v_fundador := v_pedido.data_pagamento <= date '2026-12-31';
  select id into v_perfil from public.perfis where id = auth.uid();

  insert into public.associados (contacto_id, pedido_id, tipo, fundador, data_admissao, admitido_por)
  values (v_contacto_id, v_pedido.id, p_tipo, v_fundador, v_hoje, v_perfil)
  returning * into v_associado;

  insert into public.quotas (associado_id, ano, valor, estado, data_pagamento)
  values (v_associado.id, v_ano_quota, v_valor, 'paga', v_pedido.data_pagamento);

  update public.pedidos_adesao
     set estado = 'admitido', contacto_id = v_contacto_id, updated_at = now()
   where id = v_pedido.id;

  return jsonb_build_object(
    'associado_id', v_associado.id,
    'numero',       v_associado.numero,
    'fundador',     v_fundador,
    'ano_quota',    v_ano_quota
  );
end
$$;

-- Na Supabase, as funções novas recebem execute para anon por omissão:
-- retira-se aqui (só desta função nova). A verificação de auth.role() fica como segunda barreira.
revoke all on function public.admitir_pedido(uuid, text) from public;
revoke all on function public.admitir_pedido(uuid, text) from anon;
grant execute on function public.admitir_pedido(uuid, text) to authenticated;

commit;
