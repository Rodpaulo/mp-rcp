import { useState } from 'react'
import { SAVE_ERROR } from '../admin/text.js'
import { perguntaConcluir } from './accoes.js'
import { concluirAccao } from './api.js'
import { hoje } from './datas.js'

// Na ficha, por baixo de uma acção por concluir: "Abrir cartão" (o cartão do contacto) e "Concluir".
// Depois de concluir, onMudou recarrega as revisões da ficha.
export default function AccaoAberta({ revisao, cartao, onMudou }) {
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function handleConcluir() {
    if (!window.confirm(perguntaConcluir(revisao))) return
    setAGravar(true)
    setErro('')
    try {
      await concluirAccao(revisao.id, hoje())
      await onMudou()
    } catch (error) {
      console.error('concluir acção falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
    }
  }

  return (
    <div className="rede-accao-aberta">
      {cartao && (
        <p className="rede-texto">
          <a href={cartao} target="_blank" rel="noreferrer">
            Abrir cartão
          </a>
        </p>
      )}
      <div className="rede-accoes">
        <button type="button" className="admin-button" onClick={handleConcluir} disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Concluir'}
        </button>
      </div>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
