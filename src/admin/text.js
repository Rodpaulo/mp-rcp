export const LOAD_ERROR = 'Não foi possível carregar. Tenta outra vez.'
export const SAVE_ERROR = 'Não foi possível guardar. Tenta outra vez.'

// Manual da marca: o mês leva maiúscula ("30 de Outubro de 2026"). Lista fixa, para não depender
// da língua do browser (o pt-PT do browser escreve o mês em minúscula).
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

// event_date vem como 'AAAA-MM-DD'; lida como texto, para não mudar de dia com o fuso horário.
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${day} de ${MONTHS[month - 1]} de ${year}`
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export function yesNo(value) {
  return value ? 'sim' : 'não'
}
