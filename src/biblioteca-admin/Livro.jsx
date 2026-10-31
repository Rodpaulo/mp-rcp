import { useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { apagarLivro, listarMovimentos, obterLivro } from './api.js'
import { TIPOS_MOVIMENTO, quando, quemTrouxe, rotuloEstado } from './livros.js'

// Ficha de um livro: dados, histórico de movimentos (só leitura), editar e apagar.
export default function Livro({ id, onLista, onEditar, onApagado }) {
  const [dados, setDados] = useState(undefined) // undefined: a carregar; null: não existe
  const [erro, setErro] = useState(false)
  const [erroApagar, setErroApagar] = useState(false)
  const [aApagar, setAApagar] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([obterLivro(id), listarMovimentos(id)]).then(
      ([livro, movimentos]) => activo && setDados(livro ? { livro, movimentos } : null),
      (error) => {
        console.error('carregar livro falhou:', error)
        if (activo) setErro(true)
      },
    )
    return () => {
      activo = false
    }
  }, [id])

  async function handleApagar() {
    const { livro } = dados
    if (!window.confirm(`Apagar o livro ${livro.number}, «${livro.title}»?\n\nNão se pode desfazer.`)) return
    setErroApagar(false)
    setAApagar(true)
    try {
      await apagarLivro(id)
      onApagado()
    } catch (error) {
      console.error('apagar livro falhou:', error)
      setErroApagar(true)
      setAApagar(false)
    }
  }

  const voltar = (
    <button type="button" className="admin-button-secondary" onClick={onLista}>
      Voltar à lista
    </button>
  )

  if (erro || dados === null) {
    return (
      <section className="admin-section">
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este livro não existe.'}
        </p>
        {voltar}
      </section>
    )
  }

  if (dados === undefined) return <p>A carregar…</p>

  const { livro, movimentos } = dados

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>
            {livro.number} · {livro.title}
          </h2>
          {voltar}
        </div>

        <dl className="biblioteca-dados">
          <dt>Autor</dt>
          <dd>{livro.author || 'sem autor'}</dd>
          <dt>Estado</dt>
          <dd>{rotuloEstado(livro.status)}</dd>
          <dt>Edição de entrada</dt>
          <dd>{livro.editions?.code || 'sem edição'}</dd>
          <dt>Quem trouxe</dt>
          <dd>{quemTrouxe(livro) || 'não registado'}</dd>
          {livro.note && (
            <>
              <dt>Nota</dt>
              <dd className="biblioteca-texto">{livro.note}</dd>
            </>
          )}
        </dl>

        <button type="button" className="admin-button" onClick={onEditar}>
          Editar
        </button>
      </section>

      <section className="admin-section">
        <h2>Histórico</h2>
        {movimentos.length === 0 ? (
          <p>Ainda não há movimentos.</p>
        ) : (
          <ol className="biblioteca-historico">
            {movimentos.map((movimento) => (
              <li key={movimento.id}>
                <span className="biblioteca-historico-tipo">{TIPOS_MOVIMENTO[movimento.kind] ?? movimento.kind}</span>
                {' · '}
                {movimento.editions?.code}
                {' · '}
                {quando(movimento.at)}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Só se apaga um livro sem movimentos: com histórico, o botão não aparece (SPEC 15.2). */}
      {movimentos.length === 0 && (
        <section className="admin-section">
          <h2>Apagar livro</h2>
          {erroApagar && (
            <p className="admin-error" role="alert">
              Não foi possível apagar. Tenta outra vez.
            </p>
          )}
          <button type="button" className="biblioteca-botao-perigo" onClick={handleApagar} disabled={aApagar}>
            {aApagar ? 'Um momento…' : 'Apagar livro'}
          </button>
        </section>
      )}
    </>
  )
}
