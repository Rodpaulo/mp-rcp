-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 006 · interesse em ser associado
-- Ver SPEC.md, secções 7 (página de entrada) e 14 (vista "Interessados").
-- Correr uma vez no SQL Editor do Supabase, depois de exportar as tabelas
-- actuais em CSV.
-- Aditiva:
--   - acrescenta duas colunas novas a people (com valor por omissão, por isso
--     as linhas e o código actuais não mudam);
--   - cria uma função nova, check_in_associado, com nome próprio.
-- A função check_in actual não é alterada, substituída nem sobrecarregada:
-- continua a servir o código em produção tal como está. Nenhuma política,
-- vista ou outra função existente é tocada.
-- Tudo dentro de uma transacção: ou corre inteira, ou não fica nada.
-- =====================================================================

begin;

-- ---------- Colunas novas em people ----------------------------------
-- Como o consentimento da newsletter: o interesse só sobe, nunca desce,
-- e a data fica a do primeiro pedido.

alter table public.people
  add column associado_interesse    boolean not null default false,
  add column associado_interesse_at timestamptz;

-- ---------- Função pública nova: check_in_associado -------------------
-- Faz exactamente o mesmo que check_in (chama-a por dentro) e, se o
-- interesse for verdadeiro e a presença ficou registada, marca as colunas
-- novas. Os três parâmetros são obrigatórios: sem valores por omissão não
-- há chamada que possa confundir-se com a check_in actual.
-- Devolve o mesmo que check_in: {status, edition}.

create function public.check_in_associado(
  p_email               text,
  p_newsletter          boolean,
  p_associado_interesse boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.check_in(p_email, p_newsletter);

  if p_associado_interesse and v_result->>'status' in ('ok', 'already') then
    update public.people
       set associado_interesse    = true,
           associado_interesse_at = coalesce(associado_interesse_at, now())
     where email = lower(trim(p_email))::citext;
  end if;

  return v_result;
end
$$;

-- As mesmas permissões públicas que a check_in tem hoje, e nada mais.
revoke all on function public.check_in_associado(text, boolean, boolean) from public;
grant execute on function public.check_in_associado(text, boolean, boolean) to anon, authenticated;

commit;
