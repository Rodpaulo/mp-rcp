import { useState } from 'react'
import { SAVE_ERROR } from '../admin/text.js'
import { erroCartao } from './accoes.js'
import { actualizarContacto } from './api.js'
import { INICIO_CARTAO_TRELLO } from './listas.js'

// Cabeçalho da ficha: o cartão permanente do contacto no Trello (SPEC 14.5).
// "Abrir cartão" quando há endereço; "Editar cartão" acrescenta, corrige ou retira (vazio) o endereço.
export default function CartaoContacto({ contactoId, cartao, onMudou }) {
  const [aEditar, setAEditar] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  function abrirEdicao() {
    setEndereco(cartao ?? '')
    setErro('')
    setAEditar(true)
  }

  async function handleGravar(event) {
    event.preventDefault()
    const limpo = endereco.trim()
    if (erroCartao(limpo)) {
      setErro(erroCartao(limpo))
      return
    }
    setAGravar(true)
    setErro('')
    try {
      await actualizarContacto(contactoId, { cartao_trello: limpo || null })
      onMudou(limpo || null)
      setAEditar(false)
    } catch (error) {
      console.error('gravar cartão falhou:', error)
      setErro(SAVE_ERROR)
    } finally {
      setAGravar(false)
    }
  }

  if (aEditar) {
    return (
      <form className="rede-cartao" onSubmit={handleGravar}>
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
        {erro && (
          <p className="admin-error" role="alert">
            {erro}
          </p>
        )}
        <div className="rede-accoes">
          <button type="submit" className="admin-button" disabled={aGravar}>
            {aGravar ? 'Um momento…' : 'Gravar cartão'}
          </button>
          <button type="button" className="admin-button-secondary" onClick={() => setAEditar(false)}>
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <p className="rede-cartao">
      {cartao && (
        <>
          <a href={cartao} target="_blank" rel="noreferrer">
            Abrir cartão
          </a>
          {' · '}
        </>
      )}
      <button type="button" className="rede-ligacao-texto" onClick={abrirEdicao}>
        {cartao ? 'Editar cartão' : 'Acrescentar cartão Trello'}
      </button>
    </p>
  )
}
