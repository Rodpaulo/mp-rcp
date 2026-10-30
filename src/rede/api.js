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
      .select('id, data, decisao, accao, prazo, responsavel, concluida, concluida_em, cartao_trello, registado_por, created_at')
      .eq('contacto_id', contactoId),
  )
}

export async function criarRevisao(dados) {
  return semErro(await supabase.from('revisoes').insert(dados))
}

export async function concluirAccao(revisaoId, data) {
  return semErro(await supabase.from('revisoes').update({ concluida: true, concluida_em: data }).eq('id', revisaoId))
}

// Acrescenta, corrige ou retira (null) o endereço do cartão do Trello de uma acção.
export async function actualizarCartao(revisaoId, endereco) {
  return semErro(await supabase.from('revisoes').update({ cartao_trello: endereco }).eq('id', revisaoId))
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

// A vista não tem o cartão do Trello (a migração 005 só acrescentou a coluna à tabela):
// lê-se à parte, de revisoes, para as acções da lista.
export async function listarAccoesEmAtraso() {
  const accoes = semErro(
    await supabase.from('rede_accoes_em_atraso').select('*').order('prazo').order('contacto_nome'),
  )
  if (accoes.length === 0) return accoes
  const cartoes = semErro(
    await supabase
      .from('revisoes')
      .select('id, cartao_trello')
      .in(
        'id',
        accoes.map((accao) => accao.id),
      ),
  )
  const porId = new Map(cartoes.map((item) => [item.id, item.cartao_trello]))
  return accoes.map((accao) => ({ ...accao, cartao_trello: porId.get(accao.id) ?? null }))
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

// ---------- checkins (tabela existente: só leitura) ----------

// Códigos das edições em que a pessoa fez check-in, da mais antiga para a mais recente ("RCP05", "RCP06").
export async function listarEdicoesComCheckin(personId) {
  const linhas = semErro(
    await supabase.from('checkins').select('editions(code, event_date)').eq('person_id', personId),
  )
  return linhas
    .map((linha) => linha.editions)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .map((edicao) => edicao.code)
}

// Quem marcou "Quero ser associado" na página de entrada (migração 006), o mais recente primeiro,
// com o contacto do Rede já ligado (person_id), se existir.
export async function listarInteressados() {
  const pessoas = semErro(
    await supabase
      .from('people')
      .select('id, email, name, associado_interesse_at')
      .eq('associado_interesse', true)
      .order('associado_interesse_at', { ascending: false }),
  )
  if (pessoas.length === 0) return pessoas
  const ligados = semErro(
    await supabase
      .from('contactos')
      .select('id, person_id')
      .in(
        'person_id',
        pessoas.map((pessoa) => pessoa.id),
      ),
  )
  const contactoPorPessoa = new Map(ligados.map((contacto) => [contacto.person_id, contacto.id]))
  return pessoas.map((pessoa) => ({ ...pessoa, contacto_id: contactoPorPessoa.get(pessoa.id) ?? null }))
}
