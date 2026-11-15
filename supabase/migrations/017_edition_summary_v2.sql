-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 017 · edition_summary_v2
-- Ver SPEC.md, secções 18.6 e 18.10. Correr uma vez no SQL Editor do
-- Supabase, depois da 015 (usa registrations.cancelled_at).
-- Vista nova, com as mesmas colunas da edition_summary (001), que passa a
-- contar os cancelamentos do pretix. A edition_summary não muda e fica
-- sem uso quando os ecrãs passarem a esta.
-- Regra (a presença manda):
--   - registered: inscrições sem marca de cancelado, mais as canceladas
--     com check-in;
--   - present: como antes;
--   - walk_ins: presenças sem nenhuma inscrição (um cancelado que veio
--     conta como inscrito, não como walk-in);
--   - registered_absent: inscrições sem marca e sem check-in.
-- security_invoker: respeita o RLS de quem consulta (só authenticated).
-- =====================================================================

begin;

create view public.edition_summary_v2
with (security_invoker = true) as
select
  e.code,
  e.title,
  e.event_date,
  e.is_open,
  e.room_count,
  (select count(*) from public.registrations r
     where r.edition_id = e.id
       and (r.cancelled_at is null
            or exists (select 1 from public.checkins c
                        where c.edition_id = e.id and c.person_id = r.person_id)))     as registered,
  (select count(*) from public.checkins c where c.edition_id = e.id)                    as present,
  (select count(*) from public.checkins c
     where c.edition_id = e.id
       and not exists (select 1 from public.registrations r
                       where r.edition_id = e.id and r.person_id = c.person_id))        as walk_ins,
  (select count(*) from public.registrations r
     where r.edition_id = e.id
       and r.cancelled_at is null
       and not exists (select 1 from public.checkins c
                       where c.edition_id = e.id and c.person_id = r.person_id))        as registered_absent
from public.editions e
order by e.event_date desc;

revoke all on public.edition_summary_v2 from anon;

commit;
