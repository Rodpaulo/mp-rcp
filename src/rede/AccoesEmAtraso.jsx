import { useCallback, useEffect, useState } from 'react'
import { ItemMesa } from '../admin/mesa/ListaMesa.jsx'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { concluirAccao, listarAccoesEmAtraso } from './api.js'
import { perguntaConcluir } from './accoes.js'
import { hoje, porExtenso } from './datas.js'

// Acções com prazo passado e não concluídas (vista rede_accoes_em_atraso), com "Concluir" na própria linha.
export default function AccoesEmAtraso({ aberto, recarga, onAbrir }) {
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
  }, [carregar, recarga])

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
    <>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      {accoes &&
        (accoes.length === 0 ? (
          <p>Não há acções em atraso.</p>
        ) : (
          <ul className="mesa-itens">
            {accoes.map((accao) => (
              <ItemMesa
                key={accao.id}
                aberto={accao.contacto_id === aberto}
                onAbrir={() => onAbrir(accao.contacto_id)}
                nome={accao.contacto_nome}
                detalhe={
                  `Prazo: ${porExtenso(accao.prazo)}` +
                  (accao.responsavel_nome ? ` · a cargo de ${accao.responsavel_nome}` : '') +
                  ` · revisão de ${porExtenso(accao.data)}`
                }
              >
                <p className="rede-texto">{accao.accao}</p>
                {accao.cartao_trello && (
                  <a href={accao.cartao_trello} target="_blank" rel="noreferrer" className="mesa-item-accao">
                    Abrir cartão
                  </a>
                )}
                <button
                  type="button"
                  className="mesa-item-accao"
                  onClick={() => handleConcluir(accao)}
                  disabled={aConcluir === accao.id}
                >
                  {aConcluir === accao.id ? 'Um momento…' : 'Concluir'}
                </button>
              </ItemMesa>
            ))}
          </ul>
        ))}
    </>
  )
}
