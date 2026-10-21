-- =====================================================================
-- 002 · open_edition()
-- Única leitura pública da aplicação: a página de check-in precisa de
-- mostrar o código e o título da edição aberta antes de a pessoa escrever
-- o email. Devolve só code, title e event_date da edição com is_open, ou
-- null se não houver nenhuma. Não toca em people, registrations nem
-- checkins: não expõe dados pessoais.
-- SECURITY DEFINER: o anon continua sem acesso directo à tabela editions.
-- =====================================================================

create or replace function public.open_edition()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
              'code',       e.code,
              'title',      e.title,
              'event_date', e.event_date)
       from public.editions e
      where e.is_open
      limit 1),
    'null'::jsonb
  );
$$;

revoke all on function public.open_edition() from public;
grant execute on function public.open_edition() to anon, authenticated;
