-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 003 · Biblioteca Circulante
-- Ver SPEC.md, secção 13. Correr uma vez no SQL Editor do Supabase.
-- Princípio: o público não lê nem escreve tabelas; só chama as funções
-- biblioteca_na_mesa, livro_por_numero, levar_livro e deixar_livro.
-- =====================================================================

-- ---------- Tabelas ---------------------------------------------------

create table public.books (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,                       -- 'BC-001'
  title              text not null,
  author             text,
  note               text,                                       -- "porque o trago", opcional
  status             text not null default 'na_mesa'
                     check (status in ('na_mesa', 'levado', 'desaparecido')),
  entered_edition_id uuid references public.editions(id),
  entered_by         uuid references public.people(id) on delete set null,
  created_at         timestamptz not null default now()
);

create table public.book_movements (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  edition_id  uuid not null references public.editions(id),
  person_id   uuid references public.people(id) on delete set null,
  kind        text not null check (kind in ('entrada', 'saida')),
  source      text not null default 'self' check (source in ('self', 'manual')),
  at          timestamptz not null default now()
);
create index book_movements_book_idx on public.book_movements (book_id, at);

-- ---------- Segurança: RLS ------------------------------------------

alter table public.books          enable row level security;
alter table public.book_movements enable row level security;

create policy books_admin          on public.books          for all to authenticated using (true) with check (true);
create policy book_movements_admin on public.book_movements for all to authenticated using (true) with check (true);

-- ---------- Auxiliares (não expostas ao público) --------------------

-- "12", "bc12", "BC-012", "bc 12" → 'BC-012'; outra coisa → null
create or replace function public.normalise_book_number(p text)
returns text
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') ~ '^[0-9]{1,3}$'
     and regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')::int > 0
    then 'BC-' || lpad(regexp_replace(p, '[^0-9]', '', 'g')::int::text, 3, '0')
  end
$$;

-- Devolve o id da pessoa para um email (cria se não existir), ou null se o email for inválido.
create or replace function public._person_for_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email citext := lower(trim(coalesce(p_email, '')));
  v_id    uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return null;
  end if;
  insert into public.people (email) values (v_email)
  on conflict (email) do update set email = excluded.email
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function public.normalise_book_number(text) from public;
revoke all on function public._person_for_email(text) from public;
grant execute on function public.normalise_book_number(text) to authenticated;

-- ---------- Funções públicas ----------------------------------------

-- Lista do que está na mesa. Sem dados pessoais.
create or replace function public.biblioteca_na_mesa()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'number', b.number,
           'title',  b.title,
           'author', b.author,
           'since',  e.code,
           'hands',  (select count(*) from public.book_movements m
                      where m.book_id = b.id and m.kind = 'saida')
         ) order by b.number), '[]'::jsonb)
  from public.books b
  left join public.editions e on e.id = b.entered_edition_id
  where b.status = 'na_mesa'
$$;

-- Um livro pelo número, para a página confirmar antes de agir. Sem dados pessoais.
create or replace function public.livro_por_numero(p_number text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('number', b.number, 'title', b.title, 'author', b.author, 'status', b.status)
  from public.books b
  where b.number = public.normalise_book_number(p_number)
$$;

-- Levar um livro: número + email (obrigatório).
create or replace function public.levar_livro(p_number text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num       text := public.normalise_book_number(p_number);
  v_edition   public.editions%rowtype;
  v_person_id uuid;
  v_book      public.books%rowtype;
begin
  if v_num is null then
    return jsonb_build_object('status', 'invalid_number');
  end if;

  select * into v_edition from public.editions where is_open limit 1;
  if not found then
    return jsonb_build_object('status', 'no_open_edition');
  end if;

  v_person_id := public._person_for_email(p_email);
  if v_person_id is null then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  select * into v_book from public.books where number = v_num;
  if not found then
    return jsonb_build_object('status', 'not_found', 'number', v_num);
  end if;
  if v_book.status = 'levado' then
    return jsonb_build_object('status', 'already_taken', 'number', v_num, 'title', v_book.title);
  end if;

  insert into public.book_movements (book_id, edition_id, person_id, kind)
  values (v_book.id, v_edition.id, v_person_id, 'saida');
  update public.books set status = 'levado' where id = v_book.id;

  return jsonb_build_object('status', 'ok', 'number', v_num, 'title', v_book.title);
end
$$;

-- Deixar um livro: número do autocolante + título (+ autor, nota, email opcionais).
-- Se o número já existir e o livro estiver 'levado', é um regresso: mantém título, nova entrada.
create or replace function public.deixar_livro(
  p_number text,
  p_title  text,
  p_author text default null,
  p_note   text default null,
  p_email  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num       text := public.normalise_book_number(p_number);
  v_edition   public.editions%rowtype;
  v_person_id uuid;
  v_book      public.books%rowtype;
begin
  if v_num is null then
    return jsonb_build_object('status', 'invalid_number');
  end if;

  select * into v_edition from public.editions where is_open limit 1;
  if not found then
    return jsonb_build_object('status', 'no_open_edition');
  end if;

  if p_email is not null and length(trim(p_email)) > 0 then
    v_person_id := public._person_for_email(p_email);
    if v_person_id is null then
      return jsonb_build_object('status', 'invalid_email');
    end if;
  end if;

  select * into v_book from public.books where number = v_num;
  if found then
    if v_book.status = 'na_mesa' then
      return jsonb_build_object('status', 'number_in_use', 'number', v_num, 'title', v_book.title);
    end if;
    insert into public.book_movements (book_id, edition_id, person_id, kind)
    values (v_book.id, v_edition.id, v_person_id, 'entrada');
    update public.books set status = 'na_mesa' where id = v_book.id;
    return jsonb_build_object('status', 'returned', 'number', v_num, 'title', v_book.title);
  end if;

  if p_title is null or length(trim(p_title)) < 2 then
    return jsonb_build_object('status', 'missing_title');
  end if;

  insert into public.books (number, title, author, note, entered_edition_id, entered_by)
  values (v_num, trim(p_title), nullif(trim(coalesce(p_author, '')), ''),
          nullif(trim(coalesce(p_note, '')), ''), v_edition.id, v_person_id)
  returning * into v_book;

  insert into public.book_movements (book_id, edition_id, person_id, kind)
  values (v_book.id, v_edition.id, v_person_id, 'entrada');

  return jsonb_build_object('status', 'ok', 'number', v_num, 'title', v_book.title);
end
$$;

revoke all on function public.biblioteca_na_mesa()                              from public;
revoke all on function public.livro_por_numero(text)                            from public;
revoke all on function public.levar_livro(text, text)                           from public;
revoke all on function public.deixar_livro(text, text, text, text, text)        from public;
grant execute on function public.biblioteca_na_mesa()                           to anon, authenticated;
grant execute on function public.livro_por_numero(text)                         to anon, authenticated;
grant execute on function public.levar_livro(text, text)                        to anon, authenticated;
grant execute on function public.deixar_livro(text, text, text, text, text)     to anon, authenticated;

-- ---------- Vista para o admin: resumo por edição -------------------

create view public.biblioteca_resumo
with (security_invoker = true) as
select
  e.code,
  e.event_date,
  (select count(*) from public.book_movements m where m.edition_id = e.id and m.kind = 'entrada') as entradas,
  (select count(*) from public.book_movements m where m.edition_id = e.id and m.kind = 'saida')   as saidas,
  (select count(*) from public.books b where b.status = 'na_mesa')                                as na_mesa_agora
from public.editions e
order by e.event_date desc;
