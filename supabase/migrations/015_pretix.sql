-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 015 · ligação ao pretix
-- Ver SPEC.md, secções 18.2, 18.6 e 18.10. Correr uma vez no SQL Editor
-- do Supabase, antes da 016 e da 017.
-- A partir do RCP07, as inscrições fazem-se no pretix. Esta migração só
-- acrescenta:
--   - editions.pretix_event: a forma curta do evento no pretix ('rcp07'),
--     facultativa, única quando preenchida, só minúsculas, algarismos,
--     hífenes e pontos;
--   - registrations.cancelled_at: marca de "cancelado no pretix", vazia
--     por omissão (nunca se apaga uma inscrição);
--   - a chave pretix_organizador na configuracao ('matinespensantes');
--   - pretix_event = 'rcp07' na edição RCP07, se estiver vazio.
-- Nenhuma coluna, função, vista ou política existente muda; nenhuma
-- linha existente muda, além do pretix_event do RCP07.
-- Tudo dentro de uma transacção.
-- =====================================================================

begin;

alter table public.editions
  add column pretix_event text;

alter table public.editions
  add constraint editions_pretix_event_formato
  check (pretix_event ~ '^[a-z0-9][a-z0-9.-]*$');

create unique index editions_pretix_event_unico
  on public.editions (pretix_event)
  where pretix_event is not null;

alter table public.registrations
  add column cancelled_at timestamptz;

insert into public.configuracao (chave, valor, descricao) values
  ('pretix_organizador', 'matinespensantes',
   'Organizador no pretix (pretix.eu/<organizador>/): as inscrições do RCP lêem-se daí')
on conflict (chave) do nothing;

update public.editions
   set pretix_event = 'rcp07'
 where code = 'RCP07'
   and pretix_event is null;

commit;
