// Datas do Rede como 'AAAA-MM-DD', sempre na hora local (Bruxelas):
// o "hoje" da base é UTC, por isso a aplicação envia a data explicitamente.

function paraIso(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

export function hoje() {
  return paraIso(new Date())
}

// Data por extenso com o mês em maiúscula, como no manual da marca: a mesma regra do separador RCP.
export { formatDate as porExtenso } from '../admin/text.js'

// 29 de Fevereiro + 12 meses dá 28 de Fevereiro, não 1 de Março.
export function somarMeses(isoDate, meses) {
  const [ano, mes, dia] = isoDate.split('-').map(Number)
  const data = new Date(ano, mes - 1 + meses, dia)
  if (data.getDate() !== dia) data.setDate(0)
  return paraIso(data)
}
