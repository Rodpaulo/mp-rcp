import { useState } from 'react'
import { normalizar } from './textos.js'

const LIMITE_SEM_PESQUISA = 15

// Lista de escolha do registo da pré-visualização (contacto, pedido ou associado),
// sempre à vista; com mais de 15, uma pesquisa por cima.
// `registos` = [{ id, rotulo, detalhe?, procura }].
export default function EscolhaRegisto({ titulo, vazio, registos, escolhido, onEscolher }) {
  const [pesquisa, setPesquisa] = useState('')

  if (registos.length === 0) return <p className="assoc-aviso">{vazio}</p>

  const termo = normalizar(pesquisa)
  const visiveis = termo ? registos.filter((r) => r.procura.includes(termo)) : registos

  return (
    <fieldset className="assoc-escolha">
      <legend>
        {titulo} <span className="assoc-linha-detalhe">({registos.length})</span>
      </legend>
      {registos.length > LIMITE_SEM_PESQUISA && (
        <label className="admin-field">
          <span>Pesquisar</span>
          <input type="search" value={pesquisa} onChange={(event) => setPesquisa(event.target.value)} />
        </label>
      )}
      {visiveis.length === 0 ? (
        <p>Nenhum corresponde à pesquisa.</p>
      ) : (
        <ul className="assoc-escolha-lista">
          {visiveis.map((r) => (
            <li key={r.id}>
              <label className="assoc-escolha-item">
                <input
                  type="radio"
                  name="registo-previsualizacao"
                  value={r.id}
                  checked={escolhido === r.id}
                  onChange={() => onEscolher(r.id)}
                />
                <span>
                  {r.rotulo}
                  {r.detalhe && <span className="assoc-linha-detalhe"> · {r.detalhe}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
