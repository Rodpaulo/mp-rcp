-- =====================================================================
-- !!! NÃO APLICAR !!!
-- Esta migração não foi corrida e não deve ser corrida. Os perfis da Vera e
-- da Patrícia (Patrícia Marques) entraram à mão, por insert no SQL Editor.
-- A direcção tem quatro contas no admin: Ana, Miguel, Patrícia, Vera.
-- O ficheiro fica só como registo (SPEC 16.11 e 16.13).
-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 010 · perfil da Vera
-- Ver SPEC.md, secções 14.5 e 16.11. Correr uma vez no SQL Editor do Supabase,
-- depois de criar a conta da Vera em Authentication → Users.
-- Aditiva: só insere uma linha em perfis (só lê auth.users).
-- Pára sem gravar nada se não houver exactamente uma conta sem perfil,
-- para nunca dar o nome "Vera" a outra conta.
-- =====================================================================

begin;

do $$
declare
  v_sem_perfil integer;
begin
  select count(*) into v_sem_perfil
  from auth.users u
  where not exists (select 1 from public.perfis p where p.id = u.id);

  if v_sem_perfil <> 1 then
    raise exception 'Esperava uma conta sem perfil (a da Vera); encontrei %.', v_sem_perfil;
  end if;

  insert into public.perfis (id, nome)
  select u.id, 'Vera'
  from auth.users u
  where not exists (select 1 from public.perfis p where p.id = u.id);
end
$$;

commit;
