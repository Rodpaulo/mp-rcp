-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 013 · emails aos interessados
-- Ver SPEC.md, secção 16.16. Correr uma vez no SQL Editor do Supabase,
-- depois de exportar emails_enviados em CSV.
-- Os emails 2 e 3 vão para pessoas de people (os interessados), que não
-- têm pedido nem associado. emails_enviados ganha a coluna person_id.
-- Aditiva quanto aos dados e ao código actual: nenhuma linha muda e as
-- funções publicadas continuam a gravar como hoje (não enviam person_id).
-- Duas peças de emails_enviados são substituídas por versões mais largas,
-- que todas as linhas actuais cumprem:
--   - a regra "exactamente um de pedido_id e associado_id" passa a
--     "exactamente um de pedido_id, associado_id e person_id";
--   - o índice único dos envios passa a incluir person_id (sem isso, dois
--     interessados diferentes contariam como o mesmo destinatário).
-- Acrescenta ainda a chave campanha_convites ('nao') a configuracao.
-- people não é alterada. Tudo dentro de uma transacção.
-- =====================================================================

begin;

alter table public.emails_enviados
  add column person_id uuid references public.people(id) on delete cascade;

-- A regra antiga não tem nome escrito na 008: procura-se pela definição.
do $$
declare
  v_nome text;
  v_quantos integer;
begin
  select min(conname), count(*) into v_nome, v_quantos
    from pg_constraint
   where conrelid = 'public.emails_enviados'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%pedido_id IS NULL%associado_id IS NULL%';
  if v_quantos <> 1 then
    raise exception 'Esperava uma regra pedido/associado em emails_enviados, encontrei %', v_quantos;
  end if;
  execute format('alter table public.emails_enviados drop constraint %I', v_nome);
end $$;

alter table public.emails_enviados
  add constraint emails_enviados_um_destino
  check (num_nonnulls(pedido_id, associado_id, person_id) = 1);

drop index public.emails_enviados_unico;
create unique index emails_enviados_unico
  on public.emails_enviados (email_tipo, pedido_id, associado_id, person_id, periodo)
  nulls not distinct
  where estado <> 'falhou';

create index emails_enviados_person_idx on public.emails_enviados (person_id);

-- Interruptor da campanha dos emails 2 e 3 (SPEC 16.16): só saem com 'sim' e o IBAN preenchido.
insert into public.configuracao (chave, valor, descricao) values
  ('campanha_convites', 'nao', 'Emails 2 e 3 aos interessados: "sim" envia, "nao" não envia')
on conflict (chave) do nothing;

commit;
