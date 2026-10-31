import { useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { actualizarLivro, criarLivro, listarNumeros, normalizarNumero, obterEdicaoAberta, obterLivro } from './api.js'
import { ESTADOS, proximoNumero } from './livros.js'

const NUMERO_INVALIDO = 'Número inválido: usa de 1 a 999 (por exemplo 12, ou BC-012).'
const NUMERO_REPETIDO = 'Já existe um livro com esse número.'

// Acrescentar (id null) ou editar um livro. Escreve só em books (SPEC 15).
export default function LivroForm({ id, onVoltar, onGravado }) {
  const [form, setForm] = useState(null)
  const [numeros, setNumeros] = useState([])
  const [edicaoAberta, setEdicaoAberta] = useState(null)
  const [erroCarregar, setErroCarregar] = useState(false)
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([id ? obterLivro(id) : null, listarNumeros(), id ? null : obterEdicaoAberta()]).then(
      ([livro, lista, aberta]) => {
        if (!activo) return
        setNumeros(lista)
        setEdicaoAberta(aberta)
        setForm(
          livro
            ? {
                number: livro.number,
                title: livro.title,
                author: livro.author ?? '',
                note: livro.note ?? '',
                status: livro.status,
              }
            : {
                number: proximoNumero(lista.map((item) => item.number)),
                title: '',
                author: '',
                note: '',
                status: 'na_mesa',
              },
        )
      },
      (error) => {
        console.error('carregar livro falhou:', error)
        if (activo) setErroCarregar(true)
      },
    )
    return () => {
      activo = false
    }
  }, [id])

  function mudar(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.title.trim().length < 2) {
      setErro('Escreve o título.')
      return
    }
    setAGravar(true)
    setErro('')
    try {
      const numero = await normalizarNumero(form.number)
      if (!numero) {
        setErro(NUMERO_INVALIDO)
        setAGravar(false)
        return
      }
      if (numeros.some((item) => item.number === numero && item.id !== id)) {
        setErro(NUMERO_REPETIDO)
        setAGravar(false)
        return
      }
      const dados = {
        number: numero,
        title: form.title.trim(),
        author: form.author.trim() || null,
        note: form.note.trim() || null,
      }
      if (id) {
        await actualizarLivro(id, { ...dados, status: form.status })
        onGravado(id)
      } else {
        // Livro novo da direcção: na mesa, na edição aberta (se houver), sem pessoa nem movimento.
        const gravado = await criarLivro({ ...dados, status: 'na_mesa', entered_edition_id: edicaoAberta?.id ?? null })
        onGravado(gravado.id)
      }
    } catch (error) {
      console.error('gravar livro falhou:', error)
      // 23505: número repetido (alguém gravou o mesmo número entretanto).
      setErro(error?.code === '23505' ? NUMERO_REPETIDO : SAVE_ERROR)
      setAGravar(false)
    }
  }

  const voltar = (
    <button type="button" className="admin-button-secondary" onClick={onVoltar}>
      {id ? 'Voltar ao livro' : 'Voltar à lista'}
    </button>
  )

  if (erroCarregar) {
    return (
      <section className="admin-section">
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
        {voltar}
      </section>
    )
  }

  if (!form) return <p>A carregar…</p>

  return (
    <form className="admin-section biblioteca-form" onSubmit={handleSubmit} noValidate>
      <div className="admin-section-head">
        <h2>{id ? `Editar ${form.number}` : 'Acrescentar livro'}</h2>
        {voltar}
      </div>

      <label className="admin-field">
        <span>Número (o do autocolante)</span>
        <input type="text" autoComplete="off" value={form.number} onChange={(event) => mudar('number', event.target.value)} />
      </label>
      <label className="admin-field">
        <span>Título</span>
        <input type="text" value={form.title} onChange={(event) => mudar('title', event.target.value)} />
      </label>
      <label className="admin-field">
        <span>Autor (opcional)</span>
        <input type="text" value={form.author} onChange={(event) => mudar('author', event.target.value)} />
      </label>
      <label className="admin-field">
        <span>Nota (opcional)</span>
        <textarea className="biblioteca-notas" rows={3} value={form.note} onChange={(event) => mudar('note', event.target.value)} />
      </label>

      {id ? (
        <label className="admin-field">
          <span>Estado</span>
          <select className="biblioteca-select" value={form.status} onChange={(event) => mudar('status', event.target.value)}>
            {ESTADOS.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="biblioteca-nota">
          Entra na mesa
          {edicaoAberta ? `, na edição ${edicaoAberta.code}.` : ', sem edição (não há nenhuma aberta).'}
        </p>
      )}

      {id && (
        <p className="biblioteca-nota">Mudar o estado aqui não cria movimento no histórico: só corrige o estado.</p>
      )}

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}

      <button type="submit" className="admin-button" disabled={aGravar}>
        {aGravar ? 'Um momento…' : 'Gravar livro'}
      </button>
    </form>
  )
}
