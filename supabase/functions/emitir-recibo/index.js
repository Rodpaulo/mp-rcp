// emitir-recibo — recibos das quotas (SPEC §16.17).
// Chamada pelo admin com a sessão de quem carrega (verify_jwt): a Supabase só deixa passar um JWT
// válido, e a função fala com a base com esse mesmo JWT e a chave pública, nunca com a chave de
// serviço. O RLS aplica-se; as contas sem linha em perfis são recusadas.
//
// Corpo (JSON):
//   { accao: 'previsualizar', quota_id }  → o PDF, sem número (nada é gravado)
//   { accao: 'emitir', quota_id }         → número, PDF no Storage, email 11 ou 18 com o PDF
//   { accao: 'reenviar', recibo_id }      → o mesmo PDF, por email, outra vez
// Anular é a função da base anular_recibo (migração 014), chamada directamente pelo admin.
//
// Emitir: valida tudo (quota paga, sem recibo, nome, configuração, fontes) antes de atribuir o
// número; emitir_recibo atribui o número, cria o recibo e marca a quota numa só operação. Se o
// PDF não chegar ao Storage, o recibo fica emitido sem ficheiro e "emitir" na mesma quota
// conclui-o, com o mesmo número. Se o email falhar, o recibo fica emitido e o envio "falhou":
// a passagem diária volta a tentar com o mesmo PDF.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { dataBruxelas, dataPorExtenso, euros, lerConfiguracao, lerEmailsTipo } from '../_shared/emails.js'
import {
  BUCKET, caminhoDoRecibo, descarregarPdf, emailDoRecibo, enviarRecibo, lerAssociado, nomeNoRecibo,
} from '../_shared/recibos.js'
import { gerarPdf, lerFontes } from './pdf.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CHAVES_DO_RECIBO = ['sede_morada', 'tesoureiro_nome']

function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

// Um erro com estado HTTP e uma mensagem para mostrar tal como está no admin.
class Recusa extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem)
    this.status = status
    this.extra = extra
  }
}

function clienteDaSessao(authorization) {
  const url = Deno.env.get('SUPABASE_URL')
  const chave = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !chave) throw new Error('Faltam SUPABASE_URL ou SUPABASE_ANON_KEY no ambiente.')
  return createClient(url, chave, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function lerQuota(sb, quotaId) {
  const { data, error } = await sb.from('quotas')
    .select('id, associado_id, ano, valor, estado, recibo_numero').eq('id', quotaId).maybeSingle()
  if (error) throw new Error(`quotas: ${error.message}`)
  if (!data) throw new Recusa(404, 'A quota não existe.')
  return data
}

async function reciboEmitidoDaQuota(sb, quotaId) {
  const { data, error } = await sb.from('recibos').select('*').eq('quota_id', quotaId).eq('estado', 'emitido').maybeSingle()
  if (error) throw new Error(`recibos: ${error.message}`)
  return data
}

// Tudo o que tem de estar certo antes de haver número: a quota, o nome, a configuração e as fontes.
async function prepararQuota(sb, quotaId) {
  const quota = await lerQuota(sb, quotaId)
  if (quota.estado !== 'paga') throw new Recusa(409, `A quota de ${quota.ano} ainda não está paga.`)
  const recibo = await reciboEmitidoDaQuota(sb, quotaId)
  if (recibo?.ficheiro) {
    throw new Recusa(409, `Esta quota já tem o recibo n.º ${recibo.numero}. Para o mandar outra vez, usa "Reenviar".`, { recibo })
  }
  if (!recibo && quota.recibo_numero) {
    throw new Recusa(409, `Esta quota tem um recibo registado fora da app (n.º ${quota.recibo_numero}).`)
  }
  const associado = await lerAssociado(sb, quota.associado_id)
  const nome = associado && nomeNoRecibo(associado)
  if (!nome) throw new Recusa(409, 'O associado não tem nome completo: corrige o pedido ou o contacto.')
  const config = await lerConfiguracao(sb)
  const faltam = CHAVES_DO_RECIBO.filter((chave) => !config[chave])
  if (faltam.length) throw new Recusa(409, `Falta preencher na configuração: ${faltam.join(', ')}.`)
  const fontes = await lerFontes()
  return { quota, recibo, associado, nome, config, fontes }
}

function dadosDoPdf({ numero, data, valor }, { quota, nome, config }) {
  return {
    numero,
    data: dataPorExtenso(data),
    nome,
    valor: euros(valor),
    ano: quota.ano,
    sede: config.sede_morada,
    tesoureiro: config.tesoureiro_nome,
  }
}

// Guarda o PDF. Se já lá estiver (uma tentativa anterior chegou ao Storage), fica o que lá está:
// é esse que segue por email.
async function guardarPdf(sb, recibo, pdf) {
  const caminho = caminhoDoRecibo(recibo)
  const { error } = await sb.storage.from(BUCKET).upload(caminho, pdf, { contentType: 'application/pdf', upsert: false })
  if (error) {
    const jaExiste = String(error.statusCode ?? '') === '409' || /exist|duplicate/i.test(error.message ?? '')
    if (!jaExiste) {
      throw new Error(`O recibo n.º ${recibo.numero} ficou emitido, mas o PDF não foi guardado (${error.message}). Carrega outra vez em "Emitir recibo" para o concluir com o mesmo número.`)
    }
    pdf = await descarregarPdf(sb, caminho)
  }
  const { error: erroFicheiro } = await sb.from('recibos').update({ ficheiro: caminho }).eq('id', recibo.id).is('ficheiro', null)
  if (erroFicheiro) throw new Error(`recibos: ${erroFicheiro.message}`)
  return { caminho, pdf }
}

async function previsualizar(sb, quotaId) {
  const ctx = await prepararQuota(sb, quotaId)
  const hoje = dataBruxelas()
  const pdf = await gerarPdf(ctx.fontes, dadosDoPdf({ numero: ctx.recibo?.numero ?? null, data: hoje, valor: ctx.quota.valor }, ctx))
  return new Response(pdf, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/pdf',
      'X-Email-Tipo': emailDoRecibo(ctx.associado, ctx.quota),
      'Access-Control-Expose-Headers': 'X-Email-Tipo',
    },
  })
}

async function emitir(sb, quotaId) {
  const ctx = await prepararQuota(sb, quotaId)
  const hoje = dataBruxelas()
  let recibo = ctx.recibo // emitido numa tentativa anterior, ainda sem PDF
  if (!recibo) {
    const { data, error } = await sb.rpc('emitir_recibo', { p_quota_id: quotaId, p_data: hoje })
    if (error) throw error.code === 'P0001' ? new Recusa(409, error.message) : new Error(`emitir_recibo: ${error.message}`)
    recibo = data
  }
  const gerado = await gerarPdf(ctx.fontes, dadosDoPdf(recibo, ctx))
  const { caminho, pdf } = await guardarPdf(sb, recibo, gerado)
  recibo = { ...recibo, ficheiro: caminho }

  const tipos = await lerEmailsTipo(sb)
  const envio = await enviarRecibo(sb, { recibo, associado: ctx.associado, pdf, config: ctx.config, tipos, hoje })
  return resposta(200, { recibo, envio })
}

async function reenviar(sb, reciboId) {
  const { data: recibo, error } = await sb.from('recibos').select('*').eq('id', reciboId).maybeSingle()
  if (error) throw new Error(`recibos: ${error.message}`)
  if (!recibo) throw new Recusa(404, 'O recibo não existe.')
  if (recibo.estado !== 'emitido') throw new Recusa(409, `O recibo n.º ${recibo.numero} está anulado.`)
  if (!recibo.ficheiro) {
    throw new Recusa(409, `O recibo n.º ${recibo.numero} ainda não tem PDF: usa "Emitir recibo" para o concluir.`)
  }
  const [associado, config, tipos, pdf] = await Promise.all([
    lerAssociado(sb, recibo.associado_id),
    lerConfiguracao(sb),
    lerEmailsTipo(sb),
    descarregarPdf(sb, recibo.ficheiro),
  ])
  const envio = await enviarRecibo(sb, { recibo, associado, pdf, config, tipos, hoje: dataBruxelas() })
  return resposta(200, { recibo, envio })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Só POST.' })

  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Sem sessão.' })

  try {
    const sb = clienteDaSessao(authorization)
    const { data: utilizador, error: erroUtilizador } = await sb.auth.getUser(token)
    if (erroUtilizador || !utilizador?.user) return resposta(401, { erro: 'Sessão inválida.' })
    const { data: perfil } = await sb.from('perfis').select('id').eq('id', utilizador.user.id).maybeSingle()
    if (!perfil) return resposta(403, { erro: 'Só uma conta da direcção pode emitir recibos.' })

    const corpo = await req.json().catch(() => ({}))
    if (corpo.accao === 'previsualizar' && corpo.quota_id) return await previsualizar(sb, corpo.quota_id)
    if (corpo.accao === 'emitir' && corpo.quota_id) return await emitir(sb, corpo.quota_id)
    if (corpo.accao === 'reenviar' && corpo.recibo_id) return await reenviar(sb, corpo.recibo_id)
    return resposta(400, { erro: 'Pedido inválido: falta accao, quota_id ou recibo_id.' })
  } catch (e) {
    if (e instanceof Recusa) return resposta(e.status, { erro: e.message, ...e.extra })
    console.error(e)
    return resposta(500, { erro: e?.message ?? String(e) })
  }
})
