export const LOAD_ERROR = 'Não foi possível carregar. Tenta outra vez.'
export const SAVE_ERROR = 'Não foi possível guardar. Tenta outra vez.'

// event_date vem como 'AAAA-MM-DD'; construída em hora local para não mudar de dia.
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export function yesNo(value) {
  return value ? 'sim' : 'não'
}
