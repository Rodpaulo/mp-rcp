// Todas as chamadas do Rede à Supabase passam por aqui.
// Regra (SPEC 14.7): escreve só nas tabelas novas da migração 004;
// das tabelas existentes, lê editions e people, e mais nada.

import { supabase } from '../lib/supabase.js'

const CAMPOS_LISTA = 'id, tipo_registo, nome, organizacao_id, etiquetas, estado, email, cidade, proxima_revisao'

function semErro({ data, error }) {
  if (error) throw error
  return data
}

// ---------- contactos (tabela nova: lê e escreve) ----------

export async function listarContactos() {
  return semErro(await supabase.from('contactos').select(CAMPOS_LISTA).order('nome'))
}

export async function listarOrganizacoes() {
  return semErro(
    await supabase.from('contactos').select('id, nome').eq('tipo_registo', 'organizacao').order('nome'),
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

// ---------- people (tabela existente: só leitura) ----------

export async function procurarPessoaPorEmail(email) {
  return semErro(await supabase.from('people').select('id, email, name').eq('email', email).maybeSingle())
}

export async function obterPessoa(id) {
  return semErro(await supabase.from('people').select('id, email, name').eq('id', id).maybeSingle())
}
