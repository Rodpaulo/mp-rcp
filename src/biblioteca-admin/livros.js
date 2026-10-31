// Rótulos e regras da secção Biblioteca do admin, partilhados pela lista, pela ficha e pelo formulário.
import { formatDate, formatTime } from '../admin/text.js'

export const ESTADOS = [
  { valor: 'na_mesa', rotulo: 'Na mesa' },
  { valor: 'levado', rotulo: 'Levado' },
  { valor: 'desaparecido', rotulo: 'Desaparecido' },
]

export const TIPOS_MOVIMENTO = {
  entrada: 'Entrada (deixado na mesa)',
  saida: 'Saída (levado)',
}

export function rotuloEstado(valor) {
  return ESTADOS.find((estado) => estado.valor === valor)?.rotulo ?? valor
}

export function quemTrouxe(livro) {
  return livro.people?.name || livro.people?.email || ''
}

// O seguinte ao maior número existente: BC-012 → BC-013. Sem livros, BC-001.
export function proximoNumero(numeros) {
  const maior = Math.max(0, ...numeros.map((numero) => Number(/^BC-(\d+)$/.exec(numero)?.[1] ?? 0)))
  return `BC-${String(maior + 1).padStart(3, '0')}`
}

// Data e hora de um movimento (timestamptz), no dia local, com o mês em maiúscula.
export function quando(instante) {
  const data = new Date(instante)
  const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  return `${formatDate(iso)}, ${formatTime(instante)}`
}
