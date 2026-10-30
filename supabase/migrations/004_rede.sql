-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 004 · Rede
-- Ver SPEC.md, secção 14. Correr uma vez no SQL Editor do Supabase,
-- depois de exportar as tabelas actuais em CSV.
-- Estritamente aditiva: só cria objectos novos. Não altera, não apaga,
-- não substitui nem dá permissões sobre nada do que já existe.
-- Tudo dentro de uma transacção: ou corre inteira, ou não fica nada.
-- =====================================================================

begin;

-- ---------- Tabelas ---------------------------------------------------

-- Uma linha por conta da direcção (Miguel, Ana).
create table public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  created_at  timestamptz not null default now()
);

-- Pessoas e organizações numa só lista.
create table public.contactos (
  id                uuid primary key default gen_random_uuid(),
  tipo_registo      text not null check (tipo_registo in ('pessoa', 'organizacao')),
  nome              text not null check (length(trim(nome)) > 0),
  organizacao_id    uuid references public.contactos(id) on delete set null,
  person_id         uuid references public.people(id) on delete set null,   -- só quando o email coincide
  etiquetas         text[] not null default '{}'
                    check (etiquetas <@ array['orador', 'parceiro', 'instituicao', 'media', 'patrocinador',
                                              'local', 'organizador_terceiro', 'associado']::text[]),
  estado            text not null default 'a_avaliar'
                    check (estado in ('activa', 'prospecto', 'a_avaliar', 'em_espera', 'encerrada')),
  email             citext,                                                  -- não é único
  telefone          text,
  cidade            text,
  website           text,
  origem            text,
  notas             text,
  pedido_adesao_em  date,
  proxima_revisao   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),                      -- actualizado pela aplicação
  criado_por        uuid default auth.uid() references public.perfis(id) on delete set null,
  check (organizacao_id is null or organizacao_id <> id),
  check (pedido_adesao_em is null or 'associado' = any (etiquetas))
);

create table public.interaccoes (
  id             uuid primary key default gen_random_uuid(),
  contacto_id    uuid not null references public.contactos(id) on delete cascade,
  data           date not null default current_date,
  canal          text not null
                 check (canal in ('email', 'chamada', 'presencial', 'whatsapp', 'evento', 'outro')),
  resumo         text not null check (length(trim(resumo)) > 0),
  registado_por  uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.revisoes (
  id             uuid primary key default gen_random_uuid(),
  contacto_id    uuid not null references public.contactos(id) on delete cascade,
  data           date not null default current_date,
  decisao        text not null
                 check (decisao in ('abordar', 'manter', 'reforcar', 'em_espera', 'encerrar')),
  accao          text,
  prazo          date,
  responsavel    uuid references public.perfis(id) on delete set null,
  concluida      boolean not null default false,
  concluida_em   date,
  registado_por  uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (prazo is null or accao is not null),
  check (concluida = (concluida_em is not null))
);

-- Uma participação por contacto e edição. Apagar uma edição apaga as participações,
-- para nunca impedir uma operação que hoje funciona.
create table public.participacoes (
  contacto_id  uuid not null references public.contactos(id) on delete cascade,
  edition_id   uuid not null references public.editions(id) on delete cascade,
  papel        text not null
               check (papel in ('orador', 'parceiro', 'patrocinador', 'media', 'local', 'apoio')),
  notas        text,
  created_at   timestamptz not null default now(),
  primary key (contacto_id, edition_id)
);

-- ---------- Índices --------------------------------------------------

create index contactos_nome_idx            on public.contactos (lower(nome));
create index contactos_email_idx           on public.contactos (email);
create index contactos_organizacao_idx     on public.contactos (organizacao_id);
create index contactos_person_idx          on public.contactos (person_id);
create index contactos_estado_idx          on public.contactos (estado);
create index contactos_etiquetas_idx       on public.contactos using gin (etiquetas);
create index contactos_proxima_revisao_idx on public.contactos (proxima_revisao);
create index interaccoes_contacto_idx      on public.interaccoes (contacto_id, data desc);
create index revisoes_contacto_idx         on public.revisoes (contacto_id, data desc);
create index revisoes_prazo_aberto_idx     on public.revisoes (prazo) where not concluida;
create index participacoes_edition_idx     on public.participacoes (edition_id);

-- ---------- Segurança: RLS ------------------------------------------
-- Iguais às das tabelas actuais: tudo para a direcção, nada para o público.
-- O "alter table" toca só nas tabelas criadas acima.

alter table public.perfis        enable row level security;
alter table public.contactos     enable row level security;
alter table public.interaccoes   enable row level security;
alter table public.revisoes      enable row level security;
alter table public.participacoes enable row level security;

create policy perfis_admin        on public.perfis        for all to authenticated using (true) with check (true);
create policy contactos_admin     on public.contactos     for all to authenticated using (true) with check (true);
create policy interaccoes_admin   on public.interaccoes   for all to authenticated using (true) with check (true);
create policy revisoes_admin      on public.revisoes      for all to authenticated using (true) with check (true);
create policy participacoes_admin on public.participacoes for all to authenticated using (true) with check (true);

-- ---------- Vistas ---------------------------------------------------
-- security_invoker: respeitam as políticas RLS de quem consulta (só autenticados).

-- Contactos não encerrados com a próxima revisão por marcar ou vencida (até hoje).
create view public.rede_por_rever
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.tipo_registo,
  c.estado,
  c.etiquetas,
  c.proxima_revisao,
  (select max(r.data) from public.revisoes r where r.contacto_id = c.id) as ultima_revisao
from public.contactos c
where c.estado <> 'encerrada'
  and (c.proxima_revisao is null or c.proxima_revisao <= current_date)
order by c.proxima_revisao nulls first, c.nome;

-- Acções com prazo passado e não concluídas.
create view public.rede_accoes_em_atraso
with (security_invoker = true) as
select
  r.id,
  r.contacto_id,
  c.nome as contacto_nome,
  r.data,
  r.decisao,
  r.accao,
  r.prazo,
  r.responsavel,
  p.nome as responsavel_nome
from public.revisoes r
join public.contactos c on c.id = r.contacto_id
left join public.perfis p on p.id = r.responsavel
where not r.concluida
  and r.prazo < current_date
order by r.prazo, c.nome;

-- ---------- Dados iniciais -------------------------------------------
-- Uma linha em perfis por cada conta existente no Supabase Auth (só lê auth.users).
-- O nome fica provisório (a parte do email antes do @); corrige-se depois com:
--   update public.perfis set nome = 'Miguel' where id = '...';

insert into public.perfis (id, nome)
select u.id, split_part(u.email, '@', 1)
from auth.users u
on conflict (id) do nothing;

commit;
