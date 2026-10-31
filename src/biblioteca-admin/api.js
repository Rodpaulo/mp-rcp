// O único ficheiro da secção Biblioteca do admin que fala com a Supabase (SPEC 15).
// Escreve só em books, com as políticas actuais; book_movements, editions e people só se lêem.
import { supabase } from '../lib/supabase.js'

const CAMPOS_LIVRO = 'id, number, title, author, note, status, created_at, editions(code), people(name, email)'

function semErro({ data, error }) {
  if (error) throw error
  return data
}

// ---------- books (tabela existente: lê, escreve e apaga) ----------

export async function listarLivros() {
  return semErro(await supabase.from('books').select(CAMPOS_LIVRO).order('number'))
}

export async function obterLivro(id) {
  return semErro(await supabase.from('books').select(CAMPOS_LIVRO).eq('id', id).maybeSingle())
}

export async function listarNumeros() {
  return semErro(await supabase.from('books').select('id, number'))
}

export async function criarLivro(dados) {
  return semErro(await supabase.from('books').insert(dados).select('id').single())
}

export async function actualizarLivro(id, dados) {
  return semErro(await supabase.from('books').update(dados).eq('id', id))
}

export async function apagarLivro(id) {
  return semErro(await supabase.from('books').delete().eq('id', id))
}

// "12", "bc12", "BC-012" → 'BC-012'; outra coisa → null. A mesma regra da página pública.
export async function normalizarNumero(texto) {
  return semErro(await supabase.rpc('normalise_book_number', { p: texto }))
}

// ---------- book_movements e editions (tabelas existentes: só leitura) ----------

export async function listarMovimentos(livroId) {
  return semErro(
    await supabase
      .from('book_movements')
      .select('id, kind, at, editions(code)')
      .eq('book_id', livroId)
      .order('at', { ascending: false }),
  )
}

export async function obterEdicaoAberta() {
  return semErro(await supabase.from('editions').select('id, code').eq('is_open', true).maybeSingle())
}
