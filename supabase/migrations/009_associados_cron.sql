-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 009 · relógio dos Associados
-- Ver SPEC.md, secções 16.3 e 16.13. Correr uma vez no SQL Editor do Supabase,
-- só depois de:
--   1. a migração 008 estar aplicada;
--   2. a função associados-diario estar publicada, com o segredo CRON_SECRET;
--   3. os dois segredos do Vault estarem criados (à mão, no SQL Editor, sem
--      gravar em ficheiro nenhum):
--        select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--        select vault.create_secret('<o mesmo valor do CRON_SECRET>', 'cron_secret');
-- Aditiva: activa as extensões pg_cron e pg_net (se ainda não estiverem) e
-- cria uma tarefa agendada nova. Não toca em tabelas, funções nem políticas.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- O pg_cron trabalha em UTC. 09:00 em Bruxelas é 08:00 UTC no Inverno e
-- 07:00 UTC no Verão: chama-se às duas horas e a função só trabalha quando
-- são 9 horas em Bruxelas (a outra chamada sai sem fazer nada).
select cron.schedule(
  'associados-diario',
  '0 7,8 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/associados-diario',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Para ver as execuções:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'associados-diario') order by start_time desc limit 10;
-- Para ver as respostas da função:
--   select id, status_code, content, created from net._http_response order by created desc limit 10;
