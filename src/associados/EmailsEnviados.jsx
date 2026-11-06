import { useCallback, useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { listarUltimosEnvios } from './api.js'
import Envios from './Envios.jsx'

// Os últimos 100 envios: para perceber porque é que algo não saiu (SPEC 16.15).
export default function EmailsEnviados({ onAbrirPedido, onAbrirAssociado, onAbrirInteressado }) {
  const [envios, setEnvios] = useState(null)
  const [erro, setErro] = useState(false)
  const [so, setSo] = useState('') // '' | 'falhou'

  const carregar = useCallback(() => {
    listarUltimosEnvios().then(setEnvios, (error) => {
      console.error('carregar envios falhou:', error)
      setErro(true)
    })
  }, [])

  useEffect(carregar, [carregar])

  const visiveis = (envios ?? []).filter((e) => !so || e.estado !== 'enviado')
  const falhados = (envios ?? []).filter((e) => e.estado !== 'enviado').length

  const destino = (e) =>
    e.pedido_id ? (
      <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirPedido(e.pedido_id)}>
        pedido
      </button>
    ) : e.person_id ? (
      <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirInteressado(e.person_id)}>
        interessado
      </button>
    ) : (
      <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirAssociado(e.associado_id)}>
        associado
      </button>
    )

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Emails enviados</h2>
        <button type="button" className="admin-button-secondary" onClick={carregar}>
          Actualizar
        </button>
      </div>
      <p className="assoc-nota">
        Os últimos 100. Um email que falhou volta a ser tentado na passagem seguinte da função diária, às 9h.
      </p>
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {envios && (
        <>
          <label className="assoc-opcao">
            <input type="checkbox" checked={so === 'falhou'} onChange={(event) => setSo(event.target.checked ? 'falhou' : '')} />
            Só os que não saíram ({falhados})
          </label>
          <Envios envios={visiveis} destino={destino} onMudou={carregar} />
        </>
      )}
    </section>
  )
}
