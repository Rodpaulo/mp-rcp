-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 016 · importar_inscritos
-- Ver SPEC.md, secções 18.3, 18.5 e 18.6. Correr uma vez no SQL Editor
-- do Supabase, depois da 015 (usa registrations.cancelled_at).
-- Função nova, usada pelos dois caminhos de importação: o botão
-- "Actualizar do pretix" (pela Edge Function pretix-inscritos) e o CSV.
-- A import_registrations (001) não muda e fica sem uso.
--
--   importar_inscritos(p_edition_code, p_inscritos, p_cancelados)
--     p_inscritos  jsonb: lista de {email, nome}; o nome pode faltar
--     p_cancelados text[]: emails cancelados no pretix
--   → {novos, ja_estavam, cancelados, marcados, invalidos}
--
-- Regras:
--   - a pessoa encontra-se pelo email (trim + minúsculas); cria-se se não
--     existir; o nome só preenche people.name quando está vazio;
--   - a inscrição nova grava a origem 'pretix'; uma inscrição existente
--     não se duplica nem muda de origem;
--   - repetível: carregar várias vezes dá o mesmo resultado;
--   - um email inscrito e cancelado na mesma chamada conta como inscrito
--     (a encomenda paga manda);
--   - cancelamento: marca cancelled_at só nas inscrições com origem
--     'pretix' ainda sem marca; nunca apaga; as 'mailpoet' e 'manual'
--     nunca são tocadas;
--   - uma inscrição marcada que volta a vir como inscrita perde a marca e
--     conta em "novos".
-- Corre com a sessão de quem chama (security invoker): o RLS de
-- authenticated aplica-se. Execução só para authenticated.
-- =====================================================================

begin;

create or replace function public.importar_inscritos(
  p_edition_code text,
  p_inscritos    jsonb,
  p_cancelados   text[] default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_edition_id uuid;
  v_item       jsonb;
  v_raw        text;
  v_email      citext;
  v_nome       text;
  v_person_id  uuid;
  v_cancelled  timestamptz;
  v_vistos     citext[] := '{}';
  v_novos      integer := 0;
  v_ja         integer := 0;
  v_cancelados integer := 0;
  v_marcados   integer := 0;
  v_invalidos  integer := 0;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'acesso reservado à direcção';
  end if;

  if p_inscritos is null or jsonb_typeof(p_inscritos) <> 'array' then
    raise exception 'p_inscritos tem de ser uma lista';
  end if;

  select id into v_edition_id from public.editions where code = p_edition_code;
  if v_edition_id is null then
    raise exception 'edição desconhecida: %', p_edition_code;
  end if;

  -- Inscritos (encomendas pagas, ou linhas do CSV).
  for v_item in select value from jsonb_array_elements(p_inscritos) loop
    v_email := lower(trim(coalesce(v_item->>'email', '')));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_invalidos := v_invalidos + 1;
      continue;
    end if;
    if v_email = any(v_vistos) then
      continue;                                    -- repetido na mesma lista
    end if;
    v_vistos := v_vistos || v_email;
    v_nome := nullif(trim(v_item->>'nome'), '');

    insert into public.people (email, name) values (v_email, v_nome)
    on conflict (email) do update
      set name = case
                   when nullif(trim(public.people.name), '') is null and excluded.name is not null
                     then excluded.name
                   else public.people.name
                 end
    returning id into v_person_id;

    select cancelled_at into v_cancelled
      from public.registrations
     where person_id = v_person_id and edition_id = v_edition_id;

    if not found then
      insert into public.registrations (person_id, edition_id, source)
      values (v_person_id, v_edition_id, 'pretix')
      on conflict do nothing;
      if found then
        v_novos := v_novos + 1;
      else
        v_ja := v_ja + 1;                          -- criada entretanto por outra chamada
      end if;
    elsif v_cancelled is not null then
      update public.registrations
         set cancelled_at = null
       where person_id = v_person_id and edition_id = v_edition_id;
      v_novos := v_novos + 1;
    else
      v_ja := v_ja + 1;
    end if;
  end loop;

  -- Cancelados no pretix: não entram; marcam-se os que já estavam inscritos.
  foreach v_raw in array coalesce(p_cancelados, '{}') loop
    v_email := lower(trim(coalesce(v_raw, '')));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_invalidos := v_invalidos + 1;
      continue;
    end if;
    if v_email = any(v_vistos) then
      continue;                                    -- tem uma encomenda paga: a paga manda
    end if;
    v_vistos := v_vistos || v_email;
    v_cancelados := v_cancelados + 1;

    update public.registrations r
       set cancelled_at = now()
      from public.people p
     where p.id = r.person_id
       and p.email = v_email
       and r.edition_id = v_edition_id
       and r.source = 'pretix'
       and r.cancelled_at is null;
    if found then
      v_marcados := v_marcados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'novos',      v_novos,
    'ja_estavam', v_ja,
    'cancelados', v_cancelados,
    'marcados',   v_marcados,
    'invalidos',  v_invalidos
  );
end
$$;

revoke all on function public.importar_inscritos(text, jsonb, text[]) from public;
grant execute on function public.importar_inscritos(text, jsonb, text[]) to authenticated;

commit;
