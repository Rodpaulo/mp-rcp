// Módulo comum das funções dos Associados (SPEC §16).
// Chamada ao Resend e registo em emails_enviados. Corre em Deno, nas Edge Functions
// da Supabase. Datas e campos {entre_chavetas} vêm de campos.js, partilhado com o admin.
// Segredos: lidos do ambiente, nunca escritos aqui.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { preencher, vazio } from './campos.js'

export * from './campos.js'

export const REMETENTE = 'Matinés Pensantes <geral@matinespensantes.org>'
export const RESPONDER_PARA = 'geral@matinespensantes.org'

// ---------- Cliente com a chave de serviço ---------------------------
// A Supabase injecta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente
// das Edge Functions. A chave não sai da Supabase (SPEC 16.1).

export function clienteServico() {
  const url = Deno.env.get('SUPABASE_URL')
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chave) throw new Error('Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
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

// HTML mínimo a partir do texto: parágrafos, linhas e ligações.
export function textoParaHtml(texto) {
  const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const ligar = (s) => s.replace(/https?:\/\/[^\s<;,)]+/g, (u) => `<a href="${u}">${u}</a>`)
  const paragrafos = texto.split(/\n{2,}/).map((p) => `<p>${ligar(escapar(p)).replace(/\n/g, '<br>')}</p>`)
  return `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #2C3E50;">${paragrafos.join('\n')}</div>`
}

// ---------- Resend ---------------------------------------------------

const PAUSA_MS = 600 // o plano gratuito aceita 2 pedidos por segundo

// anexos: [{ filename, content }], com content em base64 (o recibo em PDF, SPEC 16.17).
export async function enviarResend({ para, assunto, texto, anexos = [] }) {
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
        ...(anexos.length ? { attachments: anexos } : {}),
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

// Envia um email-tipo a um pedido, a um associado ou a uma pessoa (interessado, SPEC 16.16),
// uma só vez por período.
// Com reciboId (emails 11 e 18 com o PDF em anexo, SPEC 16.17), o passo 1 não se faz: um recibo
// pode ser reenviado; a base só impede duas reservas a_enviar do mesmo recibo ao mesmo tempo.
// 1. Se já houver um envio que não falhou → 'ja_enviado'.
// 2. Campos em falta → regista 'falhou' com a lista, não envia.
// 3. Reserva a linha ('a_enviar'); se outro processo a reservou → 'ja_enviado'.
// 4. Chama o Resend e grava 'enviado' ou 'falhou'.
// Devolve { resultado: 'enviado' | 'falhou' | 'ja_enviado' | 'inactivo', motivo? }.
export async function enviarEmail(sb, {
  tipo, pedidoId = null, associadoId = null, personId = null, reciboId = null, periodo = '', para, campos, hoje, anexos = [],
}) {
  if (!tipo) return { resultado: 'falhou', motivo: 'Email-tipo inexistente.' }
  if (!tipo.activo) return { resultado: 'inactivo' }
  if (!reciboId && await jaEnviado(sb, { tipo, pedidoId, associadoId, personId, periodo })) return { resultado: 'ja_enviado' }

  const assunto = preencher(tipo.assunto, campos, hoje)
  const corpo = preencher(tipo.corpo, campos, hoje)
  const emFalta = [...new Set([...assunto.emFalta, ...corpo.emFalta])]
  const linha = {
    email_tipo: tipo.chave,
    pedido_id: pedidoId,
    associado_id: associadoId,
    // person_id e recibo_id só quando existem: as gravações de pedidos e associados não dependem
    // das migrações 013 e 014.
    ...(personId ? { person_id: personId } : {}),
    ...(reciboId ? { recibo_id: reciboId } : {}),
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

  const r = await enviarResend({ para, assunto: assunto.texto, texto: corpo.texto, anexos })
  const { error: erroGravar } = await sb.from('emails_enviados').update({
    estado: r.ok ? 'enviado' : 'falhou',
    resposta_provider: r.resposta,
    enviado_em: new Date().toISOString(),
  }).eq('id', reserva.id)
  if (erroGravar) console.error(`emails_enviados ${reserva.id}: ${erroGravar.message}`)

  return r.ok ? { resultado: 'enviado' } : { resultado: 'falhou', motivo: r.resposta }
}

async function jaEnviado(sb, { tipo, pedidoId, associadoId, personId, periodo }) {
  let q = sb.from('emails_enviados').select('id').eq('email_tipo', tipo.chave).eq('periodo', periodo).neq('estado', 'falhou')
  // A base garante um só destino por linha (pedido, associado ou pessoa).
  if (pedidoId) q = q.eq('pedido_id', pedidoId)
  else if (associadoId) q = q.eq('associado_id', associadoId)
  else q = q.eq('person_id', personId)
  const { data: existentes, error: erroLer } = await q.limit(1)
  if (erroLer) throw new Error(`emails_enviados: ${erroLer.message}`)
  return existentes.length > 0
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
