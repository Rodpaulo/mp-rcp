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

// Dia local de um instante da base (timestamptz), por exemplo a data do interesse em ser associado.
export function diaLocal(instante) {
  return paraIso(new Date(instante))
}

// 29 de Fevereiro + 12 meses dá 28 de Fevereiro, não 1 de Março.
export function somarMeses(isoDate, meses) {
  const [ano, mes, dia] = isoDate.split('-').map(Number)
  const data = new Date(ano, mes - 1 + meses, dia)
  if (data.getDate() !== dia) data.setDate(0)
  return paraIso(data)
}
