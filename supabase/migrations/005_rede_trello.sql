-- =====================================================================
-- Matinés Pensantes · PWA RCP · migração 005 · Rede e Trello
-- Ver SPEC.md, secção 14.5 (regra "Trello"). Correr uma vez no SQL Editor
-- do Supabase, depois da 004.
-- Estritamente aditiva: acrescenta uma coluna opcional à tabela revisoes
-- (criada pela 004). Não toca em nenhuma tabela, vista, função ou política
-- do check-in nem da biblioteca, nem nas vistas do Rede.
-- Tudo dentro de uma transacção: ou corre inteira, ou não fica nada.
-- =====================================================================

begin;

-- Endereço do cartão no quadro "Rede" do Trello, para a acção desta revisão.
-- Opcional; quando existe, é sempre um endereço do Trello.
alter table public.revisoes
  add column cartao_trello text
  check (cartao_trello is null or cartao_trello like 'https://trello.com/%');

commit;
