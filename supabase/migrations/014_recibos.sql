-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 014 · recibos das quotas
-- Ver SPEC.md, secção 16.17. Correr uma vez no SQL Editor do Supabase,
-- DEPOIS da 013 e depois de exportar quotas e emails_enviados em CSV.
-- Aditiva:
--   - tabelas novas recibos e recibos_contadores, com RLS;
--   - funções novas proximo_numero_recibo, emitir_recibo e anular_recibo;
--   - coluna nova recibo_id em emails_enviados (vazia nas linhas actuais);
--   - bucket privado "recibos" no Storage e as suas políticas;
--   - chaves novas, vazias, em configuracao: sede_morada, tesoureiro_nome.
-- Uma peça existente é substituída: o índice único dos envios
-- (emails_enviados_unico, da 013) passa a ignorar os envios de recibos,
-- porque um recibo pode ser reenviado e um recibo anulado é substituído
-- por outro; para esses envios há um índice próprio (um só a_enviar de
-- cada vez por recibo). Todas as linhas actuais têm recibo_id vazio, por
-- isso a regra para elas fica igual. quotas, people e o resto não mudam.
-- Tudo dentro de uma transacção: ou corre inteira, ou não fica nada.
-- =====================================================================

begin;

-- ---------- Tabelas ---------------------------------------------------

-- Um recibo por quota paga. Nunca se apaga: um recibo errado fica anulado,
-- com nota, e emite-se outro (SPEC 16.17).
create table public.recibos (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique check (numero ~ '^[0-9]{4}-[0-9]{3,}$'),  -- 'AAAA-NNN'
  ano           integer not null check (ano between 2026 and 2100),
  quota_id      uuid not null references public.quotas(id) on delete restrict,
  associado_id  uuid not null references public.associados(id) on delete restrict,
  data          date not null,
  valor         numeric(8, 2) not null check (valor >= 0),
  ficheiro      text,                           -- caminho no bucket "recibos"; vazio até o PDF estar guardado
  estado        text not null default 'emitido' check (estado in ('emitido', 'anulado')),
  nota          text,
  emitido_por   uuid references public.perfis(id) on delete set null,
  anulado_por   uuid references public.perfis(id) on delete set null,
  anulado_em    timestamptz,
  created_at    timestamptz not null default now(),
  check (left(numero, 4)::integer = ano),
  check ((estado = 'anulado') = (anulado_em is not null)),
  check (estado = 'emitido' or length(trim(coalesce(nota, ''))) > 0)
);

-- Um só recibo emitido por quota; os anulados ficam como histórico.
create unique index recibos_um_emitido_por_quota on public.recibos (quota_id) where estado = 'emitido';
create index recibos_ano_idx       on public.recibos (ano, numero);
create index recibos_associado_idx on public.recibos (associado_id);

-- O último número atribuído em cada ano. Só proximo_numero_recibo lhe toca.
create table public.recibos_contadores (
  ano     integer primary key check (ano between 2026 and 2100),
  ultimo  integer not null check (ultimo > 0)
);

-- Envios de recibos: o email 11 ou 18 de cada recibo, incluindo reenvios.
alter table public.emails_enviados
  add column recibo_id uuid references public.recibos(id) on delete restrict;

drop index public.emails_enviados_unico;
create unique index emails_enviados_unico
  on public.emails_enviados (email_tipo, pedido_id, associado_id, person_id, periodo)
  nulls not distinct
  where estado <> 'falhou' and recibo_id is null;
create unique index emails_enviados_recibo_a_enviar
  on public.emails_enviados (recibo_id)
  where estado = 'a_enviar';
create index emails_enviados_recibo_idx on public.emails_enviados (recibo_id);

-- ---------- Segurança: RLS ------------------------------------------

alter table public.recibos            enable row level security;
alter table public.recibos_contadores enable row level security;

-- Como as outras tabelas dos Associados. Não há política de apagar: um recibo
-- não se apaga, anula-se.
create policy recibos_ler      on public.recibos for select to authenticated using (true);
create policy recibos_criar    on public.recibos for insert to authenticated with check (true);
create policy recibos_alterar  on public.recibos for update to authenticated using (true) with check (true);
-- recibos_contadores: sem políticas; só a função proximo_numero_recibo (security definer).

-- ---------- Funções ---------------------------------------------------

-- O número seguinte do ano, 'AAAA-NNN'. A linha do contador fica presa até ao
-- fim da transacção, por isso duas pessoas ao mesmo tempo nunca recebem o
-- mesmo número; se a transacção falhar, o número volta atrás (sem saltos).
create function public.proximo_numero_recibo(p_ano integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultimo integer;
begin
  if p_ano is null or p_ano not between 2026 and 2100 then
    raise exception 'Ano inválido para o recibo: %', p_ano;
  end if;
  insert into public.recibos_contadores as c (ano, ultimo) values (p_ano, 1)
  on conflict (ano) do update set ultimo = c.ultimo + 1
  returning ultimo into v_ultimo;
  return p_ano::text || '-' || case when v_ultimo < 1000 then lpad(v_ultimo::text, 3, '0') else v_ultimo::text end;
end
$$;

revoke all on function public.proximo_numero_recibo(integer) from public;
grant execute on function public.proximo_numero_recibo(integer) to authenticated, service_role;

-- Emite o recibo de uma quota paga, numa só operação: valida, atribui o
-- número, cria o recibo (sem ficheiro) e marca recibo_numero e recibo_data
-- na quota. Corre com a sessão de quem emite (security invoker): o RLS das
-- tabelas aplica-se e emitido_por é a conta autenticada, que tem de ter perfil.
create function public.emitir_recibo(p_quota_id uuid, p_data date)
returns public.recibos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quota  public.quotas;
  v_recibo public.recibos;
begin
  if not exists (select 1 from public.perfis where id = auth.uid()) then
    raise exception 'Só uma conta da direcção pode emitir recibos.';
  end if;
  if p_data is null or p_data > current_date + 1 then
    raise exception 'Data do recibo inválida.';
  end if;

  select * into v_quota from public.quotas where id = p_quota_id for update;
  if not found then
    raise exception 'A quota não existe.';
  end if;
  if v_quota.estado <> 'paga' then
    raise exception 'A quota de % ainda não está paga.', v_quota.ano;
  end if;
  if exists (select 1 from public.recibos where quota_id = p_quota_id and estado = 'emitido') then
    raise exception 'Esta quota já tem um recibo emitido.';
  end if;
  if v_quota.recibo_numero is not null then
    raise exception 'Esta quota tem um recibo registado fora da app (n.º %).', v_quota.recibo_numero;
  end if;

  insert into public.recibos (numero, ano, quota_id, associado_id, data, valor, emitido_por)
  values (public.proximo_numero_recibo(extract(year from p_data)::integer), extract(year from p_data)::integer,
          v_quota.id, v_quota.associado_id, p_data, v_quota.valor, auth.uid())
  returning * into v_recibo;

  update public.quotas set recibo_numero = v_recibo.numero, recibo_data = v_recibo.data where id = v_quota.id;

  return v_recibo;
end
$$;

revoke all on function public.emitir_recibo(uuid, date) from public;
grant execute on function public.emitir_recibo(uuid, date) to authenticated;

-- Anula um recibo emitido, com nota obrigatória, e limpa recibo_numero e
-- recibo_data na quota, para se poder emitir outro. O PDF fica no Storage.
create function public.anular_recibo(p_recibo_id uuid, p_nota text)
returns public.recibos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recibo public.recibos;
begin
  if not exists (select 1 from public.perfis where id = auth.uid()) then
    raise exception 'Só uma conta da direcção pode anular recibos.';
  end if;
  if length(trim(coalesce(p_nota, ''))) = 0 then
    raise exception 'A nota é obrigatória para anular um recibo.';
  end if;

  update public.recibos
     set estado = 'anulado', nota = trim(p_nota), anulado_por = auth.uid(), anulado_em = now()
   where id = p_recibo_id and estado = 'emitido'
  returning * into v_recibo;
  if not found then
    raise exception 'O recibo não existe ou já está anulado.';
  end if;

  update public.quotas set recibo_numero = null, recibo_data = null
   where id = v_recibo.quota_id and recibo_numero = v_recibo.numero;

  return v_recibo;
end
$$;

revoke all on function public.anular_recibo(uuid, text) from public;
grant execute on function public.anular_recibo(uuid, text) to authenticated;

-- ---------- Storage: bucket privado "recibos" -----------------------
-- Só PDF, até 2 MB. A direcção lê e guarda; ninguém altera nem apaga
-- (um recibo é imutável). As funções com a chave de serviço passam por cima
-- do RLS (a passagem diária só lê).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;

create policy recibos_storage_ler on storage.objects
  for select to authenticated using (bucket_id = 'recibos');
create policy recibos_storage_guardar on storage.objects
  for insert to authenticated with check (bucket_id = 'recibos');

-- ---------- Configuração: chaves novas, vazias -----------------------

insert into public.configuracao (chave, valor, descricao) values
  ('sede_morada',     null, 'Morada da sede, como aparece no recibo (pode ter várias linhas)'),
  ('tesoureiro_nome', null, 'Nome do tesoureiro, como aparece no recibo')
on conflict (chave) do nothing;

commit;
