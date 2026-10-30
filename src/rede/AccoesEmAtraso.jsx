import { useCallback, useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { concluirAccao, listarAccoesEmAtraso } from './api.js'
import { perguntaConcluir } from './accoes.js'
import { hoje, porExtenso } from './datas.js'

// Acções com prazo passado e não concluídas (vista rede_accoes_em_atraso), com "Concluir" na própria linha.
export default function AccoesEmAtraso({ onAbrir }) {
  const [accoes, setAccoes] = useState(null)
  const [erro, setErro] = useState('')
  const [aConcluir, setAConcluir] = useState(null)

  const carregar = useCallback(
    () =>
      listarAccoesEmAtraso().then(setAccoes, (error) => {
        console.error('carregar acções em atraso falhou:', error)
        setErro(LOAD_ERROR)
      }),
    [],
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleConcluir(accao) {
    if (!window.confirm(perguntaConcluir(accao))) return
    setAConcluir(accao.id)
    setErro('')
    try {
      await concluirAccao(accao.id, hoje())
      await carregar()
    } catch (error) {
      console.error('concluir acção falhou:', error)
      setErro(SAVE_ERROR)
    } finally {
      setAConcluir(null)
    }
  }

  return (
    <section className="admin-section">
      <h2>Acções em atraso</h2>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      {accoes &&
        (accoes.length === 0 ? (
          <p>Não há acções em atraso.</p>
        ) : (
          <ul className="rede-historico">
            {accoes.map((accao) => (
              <li key={accao.id}>
                <p className="rede-historico-cabeca">
                  <button type="button" className="rede-ligacao-texto" onClick={() => onAbrir(accao.contacto_id)}>
                    {accao.contacto_nome}
                  </button>
                </p>
                <p className="rede-texto">{accao.accao}</p>
                <p className="rede-historico-pe">
                  Prazo: {porExtenso(accao.prazo)}
                  {accao.responsavel_nome && ` · a cargo de ${accao.responsavel_nome}`}
                  {` · revisão de ${porExtenso(accao.data)}`}
                </p>
                {accao.cartao_trello && (
                  <p className="rede-historico-pe">
                    <a href={accao.cartao_trello} target="_blank" rel="noreferrer">
                      Abrir cartão
                    </a>
                  </p>
                )}
                <button
                  type="button"
                  className="admin-button rede-botao-lista"
                  onClick={() => handleConcluir(accao)}
                  disabled={aConcluir === accao.id}
                >
                  {aConcluir === accao.id ? 'Um momento…' : 'Concluir'}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
