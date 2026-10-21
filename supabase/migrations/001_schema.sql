-- =====================================================================
-- Matinés Pensantes · PWA RCP · esquema v0.1 (piloto de check-in, RCP06)
-- Correr uma vez no SQL Editor do Supabase (projecto na região UE).
-- Princípio: o público não lê nem escreve tabelas; só chama check_in().
-- A direcção (Miguel, Ana) entra com login e vê tudo.
-- =====================================================================

create extension if not exists citext;

-- ---------- Tabelas ---------------------------------------------------

-- A entidade central é a pessoa, não o evento: liga inscrições,
-- presenças e consentimentos ao longo das edições.
create table public.people (
  id                    uuid primary key default gen_random_uuid(),
  email                 citext not null unique,          -- guardado em minúsculas, sem espaços
  name                  text,                            -- opcional; vem do MailPoet quando existir
  newsletter_consent    boolean not null default false,
  newsletter_consent_at timestamptz,
  created_at            timestamptz not null default now()
);

create table public.editions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                      -- 'RCP06'
  title       text,                                      -- 'Portugal em Tom Maior'
  event_date  date not null,
  is_open     boolean not null default false,            -- edição em curso (só uma de cada vez)
  room_count  integer,                                   -- contagem de sala, registada no fim
  created_at  timestamptz not null default now()
);
create unique index editions_only_one_open on public.editions (is_open) where is_open;

-- Quem se inscreveu (importado do MailPoet; depois do cutover, do pretix).
create table public.registrations (
  person_id   uuid not null references public.people(id) on delete cascade,
  edition_id  uuid not null references public.editions(id) on delete cascade,
  source      text not null default 'mailpoet',          -- 'mailpoet' | 'pretix' | 'manual'
  created_at  timestamptz not null default now(),
  primary key (person_id, edition_id)
);

-- Quem veio. Uma presença por pessoa e edição — repetir o QR não duplica.
create table public.checkins (
  person_id     uuid not null references public.people(id) on delete cascade,
  edition_id    uuid not null references public.editions(id) on delete cascade,
  source        text not null default 'qr',              -- 'qr' | 'manual' (corrigido pela Ana/Miguel)
  checked_in_at timestamptz not null default now(),
  primary key (person_id, edition_id)
);

-- ---------- Segurança: RLS ------------------------------------------
-- Tudo fechado ao público (anon). Só utilizadores autenticados lêem/escrevem.
-- ATENÇÃO: no painel Supabase, Authentication → desactivar "Allow new users
-- to sign up". Só existem as contas do Miguel e da Ana, criadas à mão.

alter table public.people        enable row level security;
alter table public.editions      enable row level security;
alter table public.registrations enable row level security;
alter table public.checkins      enable row level security;

create policy people_admin        on public.people        for all to authenticated using (true) with check (true);
create policy editions_admin      on public.editions      for all to authenticated using (true) with check (true);
create policy registrations_admin on public.registrations for all to authenticated using (true) with check (true);
create policy checkins_admin      on public.checkins      for all to authenticated using (true) with check (true);

-- ---------- Função pública: check_in --------------------------------
-- Única porta de entrada da página pública. SECURITY DEFINER: corre com
-- privilégios do dono, por isso o anon não precisa de acesso às tabelas.
-- Devolve o mínimo: estado + código da edição. Nunca devolve nome nem
-- se a pessoa estava inscrita (evitar que terceiros testem emails).

create or replace function public.check_in(p_email text, p_newsletter boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   citext := lower(trim(p_email));
  v_edition public.editions%rowtype;
  v_person  public.people%rowtype;
  v_new     boolean;
begin
  -- validação simples: tem de parecer um email; não bloquear por excesso
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  select * into v_edition from public.editions where is_open limit 1;
  if not found then
    return jsonb_build_object('status', 'no_open_edition');
  end if;

  -- pessoa conhecida ou walk-in: cria se não existir; consentimento só sobe, nunca desce
  insert into public.people (email, newsletter_consent, newsletter_consent_at)
  values (v_email, p_newsletter, case when p_newsletter then now() end)
  on conflict (email) do update
    set newsletter_consent    = public.people.newsletter_consent or excluded.newsletter_consent,
        newsletter_consent_at = coalesce(public.people.newsletter_consent_at, excluded.newsletter_consent_at)
  returning * into v_person;

  insert into public.checkins (person_id, edition_id, source)
  values (v_person.id, v_edition.id, 'qr')
  on conflict (person_id, edition_id) do nothing;
  v_new := found;

  return jsonb_build_object(
    'status',  case when v_new then 'ok' else 'already' end,
    'edition', v_edition.code
  );
end
$$;

revoke all on function public.check_in(text, boolean) from public;
grant execute on function public.check_in(text, boolean) to anon, authenticated;

-- ---------- Função de administração: importar inscritos -------------
-- Recebe a lista de emails exportada do MailPoet (segmento da edição).
-- Repetível: não duplica pessoas nem inscrições. Devolve quantas inscrições novas criou.

create or replace function public.import_registrations(p_edition_code text, p_emails text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition_id uuid;
  v_person_id  uuid;
  v_email      citext;
  v_raw        text;
  v_count      integer := 0;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'acesso reservado à direcção';
  end if;

  select id into v_edition_id from public.editions where code = p_edition_code;
  if v_edition_id is null then
    raise exception 'edição desconhecida: %', p_edition_code;
  end if;

  foreach v_raw in array p_emails loop
    v_email := lower(trim(v_raw));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      continue;
    end if;

    insert into public.people (email) values (v_email)
    on conflict (email) do update set email = excluded.email   -- só para obter o id
    returning id into v_person_id;

    insert into public.registrations (person_id, edition_id, source)
    values (v_person_id, v_edition_id, 'mailpoet')
    on conflict do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end
$$;

revoke all on function public.import_registrations(text, text[]) from public;
grant execute on function public.import_registrations(text, text[]) to authenticated;

-- ---------- Vista para o admin: resumo por edição -------------------
-- security_invoker: respeita as políticas RLS de quem consulta (só autenticados).

create view public.edition_summary
with (security_invoker = true) as
select
  e.code,
  e.title,
  e.event_date,
  e.is_open,
  e.room_count,
  (select count(*) from public.registrations r where r.edition_id = e.id)                     as registered,
  (select count(*) from public.checkins c where c.edition_id = e.id)                          as present,
  (select count(*) from public.checkins c
     where c.edition_id = e.id
       and not exists (select 1 from public.registrations r
                       where r.edition_id = e.id and r.person_id = c.person_id))              as walk_ins,
  (select count(*) from public.registrations r
     where r.edition_id = e.id
       and not exists (select 1 from public.checkins c
                       where c.edition_id = e.id and c.person_id = r.person_id))              as registered_absent
from public.editions e
order by e.event_date desc;

-- ---------- Dados iniciais -------------------------------------------

insert into public.editions (code, title, event_date, is_open)
values ('RCP06', 'Portugal em Tom Maior', '2026-11-03', true);

-- Para a edição seguinte: update editions set is_open=false where code='RCP06';
--                         insert ... ('RCP07', ..., '2026-12-01', true);
-- O QR é fixo; a função check_in escolhe sempre a edição aberta.
