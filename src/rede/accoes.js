// Regras das acções abertas, iguais na ficha, na vista "Acções em atraso" e no formulário de revisão.
import { INICIO_CARTAO_TRELLO } from './listas.js'

// Texto da confirmação de "Concluir". O cartão só vive enquanto a acção está aberta (SPEC 14.5).
export function perguntaConcluir(accao) {
  const pergunta = `Marcar como concluída: «${accao.accao}»?`
  return accao.cartao_trello ? `${pergunta}\n\nArquiva o cartão no Trello.` : pergunta
}

// Devolve a mensagem de erro, ou '' se o endereço serve (vazio também serve: o cartão é opcional).
export function erroCartao(endereco) {
  return endereco && !endereco.startsWith(INICIO_CARTAO_TRELLO)
    ? `O endereço do cartão tem de começar por ${INICIO_CARTAO_TRELLO}`
    : ''
}
