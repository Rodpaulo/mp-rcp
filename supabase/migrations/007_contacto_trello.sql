-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 007 · cartão do Trello no contacto
-- Ver SPEC.md, secção 14.5 (regra "Trello", reescrita a 30 de Outubro de 2026).
-- Correr uma vez no SQL Editor do Supabase, depois da 005.
-- Estritamente aditiva: acrescenta uma coluna opcional à tabela contactos
-- (criada pela 004). A coluna revisoes.cartao_trello (005) mantém-se, sem uso.
-- Não toca em nenhuma tabela, vista, função ou política do check-in nem da
-- biblioteca, nem nas vistas do Rede.
-- Tudo dentro de uma transacção: ou corre inteira, ou não fica nada.
-- =====================================================================

begin;

-- Endereço do cartão permanente do contacto no quadro "Rede" do Trello.
-- Opcional; quando existe, é sempre um endereço do Trello.
alter table public.contactos
  add column cartao_trello text
  check (cartao_trello is null or cartao_trello like 'https://trello.com/%');

commit;
