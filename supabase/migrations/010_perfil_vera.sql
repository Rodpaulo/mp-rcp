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
