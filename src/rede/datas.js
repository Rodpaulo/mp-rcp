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

// Manual da marca: o mês leva maiúscula ("30 de Outubro de 2026"). Lista fixa, para não depender
// da língua do browser (o pt-PT do browser escreve o mês em minúscula).
const MESES = [
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

export function porExtenso(isoDate) {
  const [ano, mes, dia] = isoDate.split('-').map(Number)
  return `${dia} de ${MESES[mes - 1]} de ${ano}`
}

// 29 de Fevereiro + 12 meses dá 28 de Fevereiro, não 1 de Março.
export function somarMeses(isoDate, meses) {
  const [ano, mes, dia] = isoDate.split('-').map(Number)
  const data = new Date(ano, mes - 1 + meses, dia)
  if (data.getDate() !== dia) data.setDate(0)
  return paraIso(data)
}
