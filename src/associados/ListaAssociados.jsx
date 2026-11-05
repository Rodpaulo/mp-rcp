import { useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { anoDaQuota, dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { listarAssociados } from './api.js'
import { ESTADOS_ASSOCIADO, TIPOS_ASSOCIADO, estadoDaQuota, nomeDoAssociado, rotulo } from './textos.js'

export default function ListaAssociados({ onAbrir }) {
  const [associados, setAssociados] = useState(null)
  const [erro, setErro] = useState(false)
  const ano = anoDaQuota(dataBruxelas())

  useEffect(() => {
    listarAssociados().then(setAssociados, (error) => {
      console.error('carregar associados falhou:', error)
      setErro(true)
    })
  }, [])

  return (
    <section className="admin-section">
      <h2>Associados</h2>
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {associados &&
        (associados.length === 0 ? (
          <p>Ainda não há associados. Admite-se a partir da ficha de um pedido pago.</p>
        ) : (
          <>
            <p className="assoc-contagem">
              {associados.length} associados · {associados.filter((a) => a.fundador).length} fundadores
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table assoc-tabela">
                <thead>
                  <tr>
                    <th>N.º</th>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Fundador</th>
                    <th>Estado</th>
                    <th>Quota {ano}</th>
                  </tr>
                </thead>
                <tbody>
                  {associados.map((a) => (
                    <tr key={a.id}>
                      <td>{a.numero}</td>
                      <td>
                        <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrir(a.id)}>
                          {nomeDoAssociado(a)}
                        </button>
                      </td>
                      <td>{rotulo(TIPOS_ASSOCIADO, a.tipo)}</td>
                      <td>{a.fundador ? 'sim' : 'não'}</td>
                      <td>{rotulo(ESTADOS_ASSOCIADO, a.estado)}</td>
                      <td>{estadoDaQuota(a, ano)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </section>
  )
}
