// Regras partilhadas: a confirmação de "Concluir" (na ficha e em "Acções em atraso")
// e a validação do endereço do cartão do Trello do contacto.
import { INICIO_CARTAO_TRELLO } from './listas.js'

// Concluir uma acção não mexe no cartão do contacto, que é permanente (SPEC 14.5).
export function perguntaConcluir(accao) {
  return `Marcar como concluída: «${accao.accao}»?`
}

// Devolve a mensagem de erro, ou '' se o endereço serve (vazio também serve: o cartão é opcional).
export function erroCartao(endereco) {
  return endereco && !endereco.startsWith(INICIO_CARTAO_TRELLO)
    ? `O endereço do cartão tem de começar por ${INICIO_CARTAO_TRELLO}`
    : ''
}
