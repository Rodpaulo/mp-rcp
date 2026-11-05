// Módulo comum das funções dos Associados (SPEC §16).
// Datas de Bruxelas, campos {entre_chavetas}, chamada ao Resend e registo em
// emails_enviados. Corre em Deno, nas Edge Functions da Supabase.
// Segredos: lidos do ambiente, nunca escritos aqui.

import { createClient } from 'npm:@supabase/supabase-js@2'

export const REMETENTE = 'Matinés Pensantes <geral@matinespensantes.org>'
export const RESPONDER_PARA = 'geral@matinespensantes.org'
export const FIM_FUNDADORES = '2026-12-31'

// ---------- Cliente com a chave de serviço ---------------------------
// A Supabase injecta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente
// das Edge Functions. A chave não sai da Supabase (SPEC 16.1).

export function clienteServico() {
  const url = Deno.env.get('SUPABASE_URL')
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chave) throw new Error('Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}

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

// ---------- Valores --------------------------------------------------

// '40' ou 40 → '40 €'; '40,5' → '40,50 €'. Vazio ou inválido → null.
export function euros(valor) {
  const n = numero(valor)
  if (n === null) return null
  return `${Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')} €`
}

export function numero(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null
  const n = Number(String(valor).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function vazio(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

// ---------- Configuração e emails-tipo --------------------------------

export async function lerConfiguracao(sb) {
  const { data, error } = await sb.from('configuracao').select('chave, valor')
  if (error) throw new Error(`configuracao: ${error.message}`)
  const config = {}
  for (const { chave, valor } of data) config[chave] = vazio(valor) ? null : String(valor).trim()
  return config
}

export async function lerEmailsTipo(sb) {
  const { data, error } = await sb.from('emails_tipo').select('chave, assunto, corpo, activo')
  if (error) throw new Error(`emails_tipo: ${error.message}`)
  return Object.fromEntries(data.map((t) => [t.chave, t]))
}

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

// Campos de um pedido de adesão, mais os da configuração do ano de hoje.
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

// ---------- Preencher {campos} ----------------------------------------

const MARCA_ATE = /^\[Só até (\d{2})\/(\d{2})\/(\d{4})\] /

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
  const texto = linhas.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\{([A-Za-z0-9_]+)\}/g, (todo, nome) => {
    const v = campos[nome]
    if (vazio(v)) {
      emFalta.add(nome)
      return todo
    }
    return String(v).trim()
  })
  return { texto, emFalta: [...emFalta] }
}

// HTML mínimo a partir do texto: parágrafos, linhas e ligações.
export function textoParaHtml(texto) {
  const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const ligar = (s) => s.replace(/https?:\/\/[^\s<;,)]+/g, (u) => `<a href="${u}">${u}</a>`)
  const paragrafos = texto.split(/\n{2,}/).map((p) => `<p>${ligar(escapar(p)).replace(/\n/g, '<br>')}</p>`)
  return `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #2C3E50;">${paragrafos.join('\n')}</div>`
}

// ---------- Resend ---------------------------------------------------

const PAUSA_MS = 600 // o plano gratuito aceita 2 pedidos por segundo

export async function enviarResend({ para, assunto, texto }) {
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return { ok: false, resposta: 'RESEND_API_KEY não está definida.' }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMETENTE,
        to: [para],
        reply_to: RESPONDER_PARA,
        subject: assunto,
        text: texto,
        html: textoParaHtml(texto),
      }),
    })
    const corpo = await r.text()
    return { ok: r.ok, resposta: `${r.status} ${corpo}`.slice(0, 2000) }
  } catch (e) {
    return { ok: false, resposta: `Erro de rede: ${e?.message ?? e}`.slice(0, 2000) }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, PAUSA_MS))
  }
}

// ---------- Enviar e registar ----------------------------------------

// Envia um email-tipo a um pedido ou a um associado, uma só vez por período.
// 1. Se já houver um envio que não falhou → 'ja_enviado'.
// 2. Campos em falta → regista 'falhou' com a lista, não envia.
// 3. Reserva a linha ('a_enviar'); se outro processo a reservou → 'ja_enviado'.
// 4. Chama o Resend e grava 'enviado' ou 'falhou'.
// Devolve { resultado: 'enviado' | 'falhou' | 'ja_enviado' | 'inactivo', motivo? }.
export async function enviarEmail(sb, { tipo, pedidoId = null, associadoId = null, periodo = '', para, campos, hoje }) {
  if (!tipo) return { resultado: 'falhou', motivo: 'Email-tipo inexistente.' }
  if (!tipo.activo) return { resultado: 'inactivo' }

  let q = sb.from('emails_enviados').select('id').eq('email_tipo', tipo.chave).eq('periodo', periodo).neq('estado', 'falhou')
  q = pedidoId ? q.eq('pedido_id', pedidoId).is('associado_id', null) : q.eq('associado_id', associadoId).is('pedido_id', null)
  const { data: existentes, error: erroLer } = await q.limit(1)
  if (erroLer) throw new Error(`emails_enviados: ${erroLer.message}`)
  if (existentes.length) return { resultado: 'ja_enviado' }

  const assunto = preencher(tipo.assunto, campos, hoje)
  const corpo = preencher(tipo.corpo, campos, hoje)
  const emFalta = [...new Set([...assunto.emFalta, ...corpo.emFalta])]
  const linha = {
    email_tipo: tipo.chave,
    pedido_id: pedidoId,
    associado_id: associadoId,
    periodo,
    destinatario: vazio(para) ? '(sem email)' : para,
    assunto: assunto.texto,
    corpo: corpo.texto,
  }

  if (vazio(para) || emFalta.length) {
    const motivo = vazio(para) ? 'Sem endereço de email.' : `Campos por preencher: ${emFalta.join(', ')}`
    await sb.from('emails_enviados').insert({ ...linha, estado: 'falhou', resposta_provider: motivo })
    return { resultado: 'falhou', motivo }
  }

  const { data: reserva, error: erroReserva } = await sb
    .from('emails_enviados').insert({ ...linha, estado: 'a_enviar' }).select('id').single()
  if (erroReserva) {
    if (erroReserva.code === '23505') return { resultado: 'ja_enviado' }
    throw new Error(`emails_enviados: ${erroReserva.message}`)
  }

  const r = await enviarResend({ para, assunto: assunto.texto, texto: corpo.texto })
  const { error: erroGravar } = await sb.from('emails_enviados').update({
    estado: r.ok ? 'enviado' : 'falhou',
    resposta_provider: r.resposta,
    enviado_em: new Date().toISOString(),
  }).eq('id', reserva.id)
  if (erroGravar) console.error(`emails_enviados ${reserva.id}: ${erroGravar.message}`)

  return r.ok ? { resultado: 'enviado' } : { resultado: 'falhou', motivo: r.resposta }
}

// ---------- Respostas HTTP e segredos -------------------------------

export function json(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

// Comparação em tempo constante (para segredos e assinaturas).
export function iguais(a, b) {
  const x = new TextEncoder().encode(String(a))
  const y = new TextEncoder().encode(String(b))
  let dif = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return dif === 0
}
