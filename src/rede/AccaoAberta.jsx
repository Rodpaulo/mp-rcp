import { useState } from 'react'
import { SAVE_ERROR } from '../admin/text.js'
import { erroCartao, perguntaConcluir } from './accoes.js'
import { actualizarCartao, concluirAccao } from './api.js'
import { hoje } from './datas.js'
import { INICIO_CARTAO_TRELLO } from './listas.js'

// Na ficha, por baixo de uma acção por concluir: "Abrir cartão", "Concluir" e "Editar cartão".
// Depois de gravar, onMudou recarrega as revisões da ficha.
export default function AccaoAberta({ revisao, onMudou }) {
  const [aEditar, setAEditar] = useState(false)
  const [endereco, setEndereco] = useState('')
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

  function abrirEdicao() {
    setEndereco(revisao.cartao_trello ?? '')
    setErro('')
    setAEditar(true)
  }

  async function handleGravarCartao(event) {
    event.preventDefault()
    const limpo = endereco.trim()
    if (erroCartao(limpo)) {
      setErro(erroCartao(limpo))
      return
    }
    setAGravar(true)
    setErro('')
    try {
      // Vazio retira o cartão.
      await actualizarCartao(revisao.id, limpo || null)
      setAEditar(false)
      await onMudou()
    } catch (error) {
      console.error('gravar cartão falhou:', error)
      setErro(SAVE_ERROR)
    } finally {
      setAGravar(false)
    }
  }

  return (
    <div className="rede-accao-aberta">
      {revisao.cartao_trello && !aEditar && (
        <p className="rede-texto">
          <a href={revisao.cartao_trello} target="_blank" rel="noreferrer">
            Abrir cartão
          </a>
        </p>
      )}

      {aEditar ? (
        <form onSubmit={handleGravarCartao}>
          <label className="admin-field">
            <span>Cartão Trello (vazio retira o cartão)</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder={`${INICIO_CARTAO_TRELLO}c/…`}
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
            />
          </label>
          <div className="rede-accoes">
            <button type="submit" className="admin-button" disabled={aGravar}>
              {aGravar ? 'Um momento…' : 'Gravar cartão'}
            </button>
            <button type="button" className="admin-button-secondary" onClick={() => setAEditar(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="rede-accoes">
          <button type="button" className="admin-button" onClick={handleConcluir} disabled={aGravar}>
            {aGravar ? 'Um momento…' : 'Concluir'}
          </button>
          <button type="button" className="admin-button-secondary" onClick={abrirEdicao}>
            Editar cartão
          </button>
        </div>
      )}

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
