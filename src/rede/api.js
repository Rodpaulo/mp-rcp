// Todas as chamadas do Rede à Supabase passam por aqui.
// Regra (SPEC 14.7): escreve só nas tabelas novas da migração 004;
// das tabelas existentes, lê editions e people, e mais nada.

import { supabase } from '../lib/supabase.js'

const CAMPOS_LISTA = 'id, tipo_registo, nome, organizacao_id, etiquetas, estado, email, cidade, proxima_revisao'

function semErro({ data, error }) {
  if (error) throw error
  return data
}

// id da conta autenticada (= perfis.id), para o responsável por omissão.
export async function obterUtilizadorId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// ---------- contactos (tabela nova: lê, escreve e apaga) ----------

export async function listarContactos() {
  return semErro(await supabase.from('contactos').select(CAMPOS_LISTA).order('nome'))
}

export async function listarOrganizacoes() {
  return semErro(
    await supabase.from('contactos').select('id, nome').eq('tipo_registo', 'organizacao').order('nome'),
  )
}

export async function listarMembros(organizacaoId) {
  return semErro(
    await supabase.from('contactos').select('id, nome').eq('organizacao_id', organizacaoId).order('nome'),
  )
}

export async function obterContacto(id) {
  return semErro(await supabase.from('contactos').select('*').eq('id', id).maybeSingle())
}

export async function criarContacto(dados) {
  return semErro(await supabase.from('contactos').insert(dados).select('id').single())
}

export async function actualizarContacto(id, dados) {
  return semErro(
    await supabase
      .from('contactos')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single(),
  )
}

// A base apaga por cascata as interacções, revisões e participações (migração 004).
export async function apagarContacto(id) {
  return semErro(await supabase.from('contactos').delete().eq('id', id))
}

// ---------- perfis (tabela nova: só leitura nesta versão) ----------

export async function listarPerfis() {
  return semErro(await supabase.from('perfis').select('id, nome').order('nome'))
}

// ---------- interaccoes e revisoes (tabelas novas: lê e escreve) ----------

export async function listarInteraccoes(contactoId) {
  return semErro(
    await supabase
      .from('interaccoes')
      .select('id, data, canal, resumo, registado_por, created_at')
      .eq('contacto_id', contactoId),
  )
}

export async function criarInteraccao(dados) {
  return semErro(await supabase.from('interaccoes').insert(dados))
}

export async function listarRevisoes(contactoId) {
  return semErro(
    await supabase
      .from('revisoes')
      .select('id, data, decisao, accao, prazo, responsavel, concluida, concluida_em, registado_por, created_at')
      .eq('contacto_id', contactoId),
  )
}

export async function criarRevisao(dados) {
  return semErro(await supabase.from('revisoes').insert(dados))
}

export async function concluirAccao(revisaoId, data) {
  return semErro(await supabase.from('revisoes').update({ concluida: true, concluida_em: data }).eq('id', revisaoId))
}

// ---------- vistas novas (só leitura) ----------

export async function listarPorRever() {
  return semErro(
    await supabase
      .from('rede_por_rever')
      .select('*')
      .order('proxima_revisao', { ascending: true, nullsFirst: true })
      .order('nome'),
  )
}

export async function listarAccoesEmAtraso() {
  return semErro(await supabase.from('rede_accoes_em_atraso').select('*').order('prazo').order('contacto_nome'))
}

// ---------- participacoes (tabela nova: lê, escreve e apaga) ----------

export async function listarParticipacoes(contactoId) {
  return semErro(
    await supabase
      .from('participacoes')
      .select('edition_id, papel, notas, editions(code, title, event_date)')
      .eq('contacto_id', contactoId),
  )
}

export async function criarParticipacao(dados) {
  return semErro(await supabase.from('participacoes').insert(dados))
}

export async function apagarParticipacao(contactoId, edicaoId) {
  return semErro(
    await supabase.from('participacoes').delete().eq('contacto_id', contactoId).eq('edition_id', edicaoId),
  )
}

export async function contarParticipacoes(contactoId) {
  const { count, error } = await supabase
    .from('participacoes')
    .select('contacto_id', { count: 'exact', head: true })
    .eq('contacto_id', contactoId)
  if (error) throw error
  return count ?? 0
}

// ---------- editions (tabela existente: só leitura) ----------

export async function listarEdicoes() {
  return semErro(
    await supabase.from('editions').select('id, code, title, event_date').order('event_date', { ascending: false }),
  )
}

// ---------- people (tabela existente: só leitura) ----------

export async function procurarPessoaPorEmail(email) {
  return semErro(await supabase.from('people').select('id, email, name').eq('email', email).maybeSingle())
}

export async function obterPessoa(id) {
  return semErro(await supabase.from('people').select('id, email, name').eq('id', id).maybeSingle())
}
