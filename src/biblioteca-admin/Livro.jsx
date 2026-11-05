import { useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { apagarLivro, listarMovimentos, obterLivro } from './api.js'
import { TIPOS_MOVIMENTO, quando, quemTrouxe, rotuloEstado } from './livros.js'
import Accoes from '../admin/mesa/Accoes.jsx'
import Dados from '../admin/mesa/Dados.jsx'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'

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

  // No telemóvel a ficha ocupa o ecrã e "Voltar à lista" regressa à lista; ao lado da lista não aparece.
  const voltar = (
    <button type="button" className="mesa-voltar" onClick={onLista}>
      Voltar à lista
    </button>
  )

  if (erro || dados === null) {
    return (
      <FichaCartao>
        {voltar}
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este livro não existe.'}
        </p>
      </FichaCartao>
    )
  }

  if (dados === undefined) return <p>A carregar…</p>

  const { livro, movimentos } = dados

  return (
    <>
      {voltar}
      <FichaCartao sobretitulo={`Livro ${livro.number}`} nome={livro.title}>
        <div className="mesa-ficha-estado">
          <Pilula estado={livro.status}>{rotuloEstado(livro.status)}</Pilula>
        </div>

        <Dados
          itens={[
            { rotulo: 'Autor', valor: livro.author || 'sem autor' },
            { rotulo: 'Edição de entrada', valor: livro.editions?.code || 'sem edição' },
            { rotulo: 'Quem trouxe', valor: quemTrouxe(livro) || 'não registado' },
            { rotulo: 'Nota', valor: livro.note && <span className="biblioteca-texto">{livro.note}</span> },
          ]}
        />

        {/* Só se apaga um livro sem movimentos: com histórico, "Apagar livro" não aparece (SPEC 15.2). */}
        <Accoes
          saidas={
            movimentos.length === 0 && (
              <button type="button" className="mesa-saida" onClick={handleApagar} disabled={aApagar}>
                {aApagar ? 'Um momento…' : 'Apagar livro'}
              </button>
            )
          }
        >
          <button type="button" className="mesa-botao" onClick={onEditar}>
            Editar
          </button>
        </Accoes>
        {erroApagar && (
          <p className="admin-error" role="alert">
            Não foi possível apagar. Tenta outra vez.
          </p>
        )}
      </FichaCartao>

      <FichaCartao titulo="Histórico">
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
      </FichaCartao>
    </>
  )
}
