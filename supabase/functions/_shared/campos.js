// Campos {entre_chavetas} dos emails-tipo, datas de Bruxelas e valores (SPEC §16.8, §16.15).
// Sem importações: usado pelas Edge Functions (Deno) e pelo separador Associados do admin (Vite),
// para a pré-visualização mostrar exactamente o que o Resend envia.

export const FIM_FUNDADORES = '2026-12-31'

// ---------- Datas (sempre no fuso de Bruxelas) ------------------------

const FUSO = 'Europe/Brussels'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function partes(data) {
  const p = {}
  for (const { type, value } of new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(data)) p[type] = value
  return p
}

// 'AAAA-MM-DD' do dia em Bruxelas.
export function dataBruxelas(instante = new Date()) {
  const p = partes(instante instanceof Date ? instante : new Date(instante))
  return `${p.year}-${p.month}-${p.day}`
}

export function horaBruxelas(instante = new Date()) {
  return Number(partes(instante).hour)
}

// Dias de calendário entre dois 'AAAA-MM-DD'.
export function diasEntre(de, ate) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000)
}

// '2026-11-05' → '5 de Novembro de 2026' (como em src/admin/text.js).
export function dataPorExtenso(dia) {
  if (!dia) return null
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

export function anoBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
}

// Ano da quota que conta hoje: 2027 até ao fim do primeiro exercício, depois o ano corrente.
export function anoDaQuota(hoje) {
  return Math.max(2027, Number(hoje.slice(0, 4)))
}

// ---------- Valores --------------------------------------------------

export function vazio(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

export function numero(valor) {
  if (vazio(valor)) return null
  const n = Number(String(valor).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// '40' ou 40 → '40 €'; '40,5' → '40,50 €'. Vazio ou inválido → null.
export function euros(valor) {
  const n = numero(valor)
  if (n === null) return null
  return `${Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')} €`
}

// ---------- Campos de cada fonte ---------------------------------------

// Campos que vêm da configuração. {valor_quota} é o do ano dado.
export function camposConfiguracao(config, ano) {
  return {
    link_pedido_adesao: config.link_pedido_adesao,
    IBAN: config.iban,
    titular_conta: config.titular_conta,
    assinatura: config.assinatura,
    proxima_sessao: config.proxima_sessao,
    mes_regresso: config.mes_regresso,
    consequencia_90_dias: config.consequencia_90_dias,
    valor_quota: euros(config[`valor_quota_${ano}`]),
  }
}

function primeiraPalavra(nome) {
  return nome?.trim().split(/\s+/)[0] || null
}

// Pedido de adesão (emails 3-A a 8), com a configuração do ano de hoje.
export function camposPedido(pedido, config, hoje) {
  return {
    ...camposConfiguracao(config, hoje.slice(0, 4)),
    primeiro_nome: pedido.nome_emails?.trim(),
    nome_completo: pedido.nome_completo?.trim(),
    email: pedido.email,
    aniversario: pedido.aniversario,
    data_pedido: dataPorExtenso(dataBruxelas(pedido.data_pedido)),
  }
}

// Contacto do Rede sem pedido (emails 1, 2, 3): o primeiro nome é a primeira palavra do nome.
export function camposContacto(contacto, config, hoje) {
  return {
    ...camposConfiguracao(config, hoje.slice(0, 4)),
    primeiro_nome: primeiraPalavra(contacto.nome),
    nome_completo: contacto.nome?.trim(),
    email: contacto.email,
  }
}

// Associado (emails 9 a 18): nome e email do pedido e, sem pedido, do contacto.
// `associado` traz `pedido` e `contacto` embutidos; `quota`, se vier, dá {ano}, {valor_quota}
// e {numero_recibo}.
export function camposAssociado(associado, config, hoje, quota = null) {
  const pedido = associado.pedido ?? null
  const contacto = associado.contacto ?? null
  const campos = {
    ...camposConfiguracao(config, hoje.slice(0, 4)),
    primeiro_nome: pedido?.nome_emails?.trim() || primeiraPalavra(contacto?.nome),
    nome_completo: pedido?.nome_completo?.trim() || contacto?.nome?.trim(),
    email: pedido?.email ?? contacto?.email ?? null,
    aniversario: pedido?.aniversario ?? null,
    data_pedido: pedido ? dataPorExtenso(dataBruxelas(pedido.data_pedido)) : null,
  }
  if (quota) {
    campos.ano = String(quota.ano)
    campos.valor_quota = euros(quota.valor)
    campos.numero_recibo = quota.recibo_numero ?? null
  }
  return campos
}

// ---------- Preencher {campos} ----------------------------------------

const MARCA_ATE = /^\[Só até (\d{2})\/(\d{2})\/(\d{4})\] /
const CAMPO = /\{([A-Za-z0-9_]+)\}/g

// Nomes dos campos que um texto usa, pela ordem em que aparecem, sem repetir.
export function camposDoTexto(...textos) {
  const nomes = []
  for (const t of textos) for (const [, nome] of String(t ?? '').matchAll(CAMPO)) if (!nomes.includes(nome)) nomes.push(nome)
  return nomes
}

// Devolve { texto, emFalta }. Um campo vazio ou desconhecido fica em emFalta
// e o email não deve sair (SPEC 16.8). Uma linha marcada "[Só até dd/mm/aaaa] "
// só fica se hoje for até essa data, e perde a marca.
export function preencher(modelo, campos, hoje) {
  const emFalta = new Set()
  const linhas = []
  for (const linha of String(modelo).replace(/\r\n?/g, '\n').split('\n')) {
    const m = linha.match(MARCA_ATE)
    if (m) {
      if (hoje > `${m[3]}-${m[2]}-${m[1]}`) continue
      linhas.push(linha.slice(m[0].length))
    } else {
      linhas.push(linha)
    }
  }
  const texto = linhas.join('\n').replace(/\n{3,}/g, '\n\n').replace(CAMPO, (todo, nome) => {
    const v = campos[nome]
    if (vazio(v)) {
      emFalta.add(nome)
      return todo
    }
    return String(v).trim()
  })
  return { texto, emFalta: [...emFalta] }
}
