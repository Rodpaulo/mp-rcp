// Todas as chamadas do separador Associados à Supabase passam por aqui (SPEC 16.15).
// Escreve só nas tabelas da migração 008 e em contactos (ligar ou criar o contacto do pedido,
// como o webhook); chama admitir_pedido (migração 011). Lê perfis e people (os interessados).

import { supabase } from '../lib/supabase.js'
import { dataBruxelas, preencher, vazio } from '../../supabase/functions/_shared/campos.js'

export const ESTADOS_ABERTOS = ['recebido', 'instrucoes_enviadas', 'pago']

function semErro({ data, error }) {
  if (error) throw error
  return data
}

// Erro com uma mensagem para mostrar tal como está.
function aviso(mensagem) {
  return Object.assign(new Error(mensagem), { aviso: true })
}

const agora = () => new Date().toISOString()

// id da conta autenticada (= perfis.id).
export async function obterUtilizadorId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function listarPerfis() {
  return semErro(await supabase.from('perfis').select('id, nome').order('nome'))
}

async function nomeDoUtilizador() {
  const id = await obterUtilizadorId()
  if (!id) return null
  const perfil = semErro(await supabase.from('perfis').select('nome').eq('id', id).maybeSingle())
  return perfil?.nome ?? null
}

// ---------- configuracao ----------

export async function listarConfiguracao() {
  return semErro(await supabase.from('configuracao').select('chave, valor, descricao, updated_at').order('chave'))
}

// Igual ao das Edge Functions: valores vazios contam como null.
export async function lerConfiguracao() {
  const linhas = await listarConfiguracao()
  return Object.fromEntries(linhas.map(({ chave, valor }) => [chave, vazio(valor) ? null : String(valor).trim()]))
}

export async function gravarConfiguracao(chave, valor) {
  return semErro(
    await supabase
      .from('configuracao')
      .update({ valor: vazio(valor) ? null : valor.trim(), updated_at: agora() })
      .eq('chave', chave)
      .select('chave')
      .single(),
  )
}

export async function criarConfiguracao({ chave, valor, descricao }) {
  return semErro(
    await supabase
      .from('configuracao')
      .insert({ chave, valor: vazio(valor) ? null : valor.trim(), descricao: vazio(descricao) ? null : descricao.trim() })
      .select('chave')
      .single(),
  )
}

// ---------- pedidos_adesao ----------

const CAMPOS_PEDIDO_LISTA = 'id, nome_completo, nome_emails, email, aniversario, data_pedido, estado, data_pagamento'

export async function listarPedidos() {
  return semErro(
    await supabase.from('pedidos_adesao').select(CAMPOS_PEDIDO_LISTA).order('data_pedido', { ascending: false }),
  )
}

export async function obterPedido(id) {
  return semErro(
    await supabase.from('pedidos_adesao').select('*, contacto:contactos!pedidos_adesao_contacto_id_fkey(id, nome)').eq('id', id).maybeSingle(),
  )
}

export async function obterAssociadoDoPedido(pedidoId) {
  return semErro(
    await supabase.from('associados').select('id, numero, fundador, tipo').eq('pedido_id', pedidoId).maybeSingle(),
  )
}

export async function pedidoEmAbertoComEmail(email) {
  return semErro(
    await supabase
      .from('pedidos_adesao')
      .select('id, nome_completo')
      .eq('email', email)
      .in('estado', ESTADOS_ABERTOS)
      .limit(1)
      .maybeSingle(),
  )
}

// Só a partir de recebido ou instrucoes_enviadas; grava quem confirmou.
export async function confirmarPagamento(id, dataPagamento) {
  const linhas = semErro(
    await supabase
      .from('pedidos_adesao')
      .update({
        estado: 'pago',
        data_pagamento: dataPagamento,
        pagamento_confirmado_por: await obterUtilizadorId(),
        updated_at: agora(),
      })
      .eq('id', id)
      .in('estado', ['recebido', 'instrucoes_enviadas'])
      .select('id'),
  )
  if (linhas.length === 0) throw aviso('O pedido mudou de estado entretanto. Volta a abrir a ficha.')
}

// Desistiu, não admitido, cancelado: a nota entra em notas, com a data e quem a escreveu.
export async function registarSaida(pedido, estado, rotuloEstado, nota) {
  const quem = (await nomeDoUtilizador()) ?? 'direcção'
  const linha = `${dataBruxelas()} · ${quem} · ${rotuloEstado}: ${nota.trim()}`
  const linhas = semErro(
    await supabase
      .from('pedidos_adesao')
      .update({ estado, notas: pedido.notas ? `${pedido.notas}\n${linha}` : linha, updated_at: agora() })
      .eq('id', pedido.id)
      .in('estado', ESTADOS_ABERTOS)
      .select('id'),
  )
  if (linhas.length === 0) throw aviso('O pedido mudou de estado entretanto. Volta a abrir a ficha.')
}

// Migração 011: associado, quota e estado numa só operação.
export async function admitirPedido(id, tipo) {
  return semErro(await supabase.rpc('admitir_pedido', { p_pedido_id: id, p_tipo: tipo }))
}

// Como o webhook (SPEC 16.9): uma pessoa com o mesmo email ganha a etiqueta e a data do pedido;
// sem ela, cria-se o contacto.
async function ligarContacto(pedido) {
  const dia = dataBruxelas(pedido.data_pedido)
  const existente = semErro(
    await supabase
      .from('contactos')
      .select('id, etiquetas, pedido_adesao_em')
      .eq('tipo_registo', 'pessoa')
      .eq('email', pedido.email)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  )
  let contactoId
  if (existente) {
    contactoId = existente.id
    semErro(
      await supabase
        .from('contactos')
        .update({
          etiquetas: existente.etiquetas.includes('associado') ? existente.etiquetas : [...existente.etiquetas, 'associado'],
          pedido_adesao_em: existente.pedido_adesao_em ?? dia,
          updated_at: agora(),
        })
        .eq('id', contactoId),
    )
  } else {
    const pessoa = semErro(await supabase.from('people').select('id').eq('email', pedido.email).maybeSingle())
    const novo = semErro(
      await supabase
        .from('contactos')
        .insert({
          tipo_registo: 'pessoa',
          nome: pedido.nome_completo,
          email: pedido.email,
          etiquetas: ['associado'],
          pedido_adesao_em: dia,
          person_id: pessoa?.id ?? null,
          estado: 'a_avaliar',
          origem: 'Pedido de adesão (à mão)',
        })
        .select('id')
        .single(),
    )
    contactoId = novo.id
  }
  semErro(await supabase.from('pedidos_adesao').update({ contacto_id: contactoId }).eq('id', pedido.id))
}

// Pedido criado à mão (excepção, SPEC 16.15). Com "Já recebeu os dados de pagamento",
// o email 4 fica registado como enviado à mão e o pedido passa a instrucoes_enviadas.
// `email4` = { assunto, corpo } já preenchidos, para ficar no registo.
export async function criarPedidoManual(dados, { jaRecebeu, email4 }) {
  const pedido = semErro(
    await supabase
      .from('pedidos_adesao')
      .insert({
        ...dados,
        tally_id: `manual-${crypto.randomUUID()}`,
        estado: jaRecebeu ? 'instrucoes_enviadas' : 'recebido',
      })
      .select('*')
      .single(),
  )
  try {
    await ligarContacto(pedido)
  } catch (error) {
    // O pedido fica criado; o contacto liga-se ao admitir (admitir_pedido).
    console.error('ligar contacto falhou:', error)
  }
  if (jaRecebeu) {
    semErro(
      await supabase.from('emails_enviados').insert({
        email_tipo: '04_pedido_recebido',
        pedido_id: pedido.id,
        destinatario: pedido.email,
        assunto: email4.assunto,
        corpo: email4.corpo,
        estado: 'enviado',
        resposta_provider: 'Registado à mão no admin',
      }),
    )
  }
  return pedido
}

// ---------- associados e quotas ----------

const CAMPOS_ASSOCIADO = `id, numero, tipo, fundador, data_admissao, admitido_por, estado, pedido_id, contacto_id,
  contacto:contactos!associados_contacto_id_fkey(id, nome, email),
  pedido:pedidos_adesao!associados_pedido_id_fkey(id, nome_completo, nome_emails, email, aniversario, data_pedido, data_pagamento),
  quotas(id, ano, valor, estado, data_pagamento, recibo_numero, recibo_data)`

export async function listarAssociados() {
  return semErro(await supabase.from('associados').select(CAMPOS_ASSOCIADO).order('numero'))
}

export async function obterAssociado(id) {
  return semErro(await supabase.from('associados').select(CAMPOS_ASSOCIADO).eq('id', id).maybeSingle())
}

export async function registarRecibo(quotaId, reciboNumero, reciboData) {
  return semErro(
    await supabase
      .from('quotas')
      .update({ recibo_numero: reciboNumero.trim(), recibo_data: reciboData })
      .eq('id', quotaId)
      .eq('estado', 'paga')
      .select('id')
      .single(),
  )
}

// ---------- interessados (people, SPEC 16.16) ----------

const EMAILS_FUNIL = ['02_convite_contactos', '03_ultimos_dias_sem_pedido']

// Quem marcou "Quero ser associado" na página de entrada, o mais recente primeiro, com o funil:
// o pedido mais recente com o mesmo email (se houver) e os envios dos emails 2 e 3.
// people só se lê.
export async function listarInteressados() {
  const [pessoas, pedidos, envios] = await Promise.all([
    supabase
      .from('people')
      .select('id, email, name, associado_interesse_at')
      .eq('associado_interesse', true)
      .order('associado_interesse_at', { ascending: false })
      .then(semErro),
    supabase.from('pedidos_adesao').select('id, email, data_pedido, estado').order('data_pedido', { ascending: false }).then(semErro),
    supabase
      .from('emails_enviados')
      .select('person_id, email_tipo, estado, enviado_em')
      .not('person_id', 'is', null)
      .in('email_tipo', EMAILS_FUNIL)
      .order('enviado_em')
      .then(semErro),
  ])
  const pedidoPorEmail = new Map()
  for (const p of pedidos) {
    const chave = String(p.email).toLowerCase()
    if (!pedidoPorEmail.has(chave)) pedidoPorEmail.set(chave, p)
  }
  // Para cada pessoa e email, o envio que conta: o enviado; sem ele, a última tentativa.
  const envioDe = new Map()
  for (const e of envios) {
    const chave = `${e.person_id}|${e.email_tipo}`
    if (envioDe.get(chave)?.estado !== 'enviado') envioDe.set(chave, e)
  }
  return pessoas.map((pessoa) => ({
    ...pessoa,
    pedido: pedidoPorEmail.get(String(pessoa.email).toLowerCase()) ?? null,
    email2: envioDe.get(`${pessoa.id}|02_convite_contactos`) ?? null,
    email3: envioDe.get(`${pessoa.id}|03_ultimos_dias_sem_pedido`) ?? null,
  }))
}

export async function listarEnviosDaPessoa(personId) {
  return semErro(
    await supabase.from('emails_enviados').select(CAMPOS_ENVIO).eq('person_id', personId).order('enviado_em', { ascending: false }),
  )
}

// ---------- emails_tipo ----------

export async function listarEmailsTipo() {
  return semErro(
    await supabase.from('emails_tipo').select('chave, nome, quando, automatico, activo, updated_at').order('chave'),
  )
}

export async function obterEmailTipo(chave) {
  return semErro(await supabase.from('emails_tipo').select('*').eq('chave', chave).maybeSingle())
}

export async function gravarEmailTipo(chave, { assunto, corpo }) {
  return semErro(
    await supabase
      .from('emails_tipo')
      .update({ assunto, corpo, updated_at: agora() })
      .eq('chave', chave)
      .select('chave, updated_at')
      .single(),
  )
}

// Fonte da pré-visualização do email 1: contactos do Rede com a etiqueta associado
// e sem pedido de adesão.
export async function listarContactosSemPedido() {
  const [contactos, pedidos] = await Promise.all([
    supabase
      .from('contactos')
      .select('id, nome, email')
      .eq('tipo_registo', 'pessoa')
      .contains('etiquetas', ['associado'])
      .order('nome')
      .then(semErro),
    supabase.from('pedidos_adesao').select('contacto_id').not('contacto_id', 'is', null).then(semErro),
  ])
  const comPedido = new Set(pedidos.map((p) => p.contacto_id))
  return contactos.filter((c) => !comPedido.has(c.id))
}

// O texto do email 4 preenchido para um pedido, para o registo do "já recebeu".
export function preencherEmail(tipo, campos, hoje) {
  return { assunto: preencher(tipo.assunto, campos, hoje), corpo: preencher(tipo.corpo, campos, hoje) }
}

// ---------- emails_enviados ----------

const CAMPOS_ENVIO = 'id, email_tipo, pedido_id, associado_id, person_id, periodo, destinatario, assunto, enviado_em, estado, resposta_provider'

export async function listarEnviosDoPedido(pedidoId) {
  return semErro(
    await supabase.from('emails_enviados').select(CAMPOS_ENVIO).eq('pedido_id', pedidoId).order('enviado_em', { ascending: false }),
  )
}

export async function listarEnviosDoAssociado(associadoId) {
  return semErro(
    await supabase
      .from('emails_enviados')
      .select(CAMPOS_ENVIO)
      .eq('associado_id', associadoId)
      .order('enviado_em', { ascending: false }),
  )
}

export async function listarUltimosEnvios() {
  return semErro(
    await supabase.from('emails_enviados').select(CAMPOS_ENVIO).order('enviado_em', { ascending: false }).limit(100),
  )
}

// Uma reserva presa (a função morreu entre a reserva e a resposta) passa a falhou:
// a função diária volta a tentar (SPEC 16.9).
export async function libertarEnvio(id) {
  return semErro(
    await supabase
      .from('emails_enviados')
      .update({ estado: 'falhou', resposta_provider: 'Reserva libertada à mão no admin' })
      .eq('id', id)
      .eq('estado', 'a_enviar')
      .select('id')
      .single(),
  )
}
