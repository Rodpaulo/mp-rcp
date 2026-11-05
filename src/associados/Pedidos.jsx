import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { ESTADOS_ABERTOS, listarPedidos } from './api.js'
import { ESTADOS_PEDIDO, rotulo } from './textos.js'

// Filtros: '' = em aberto (por omissão), 'todos', ou um estado.
export default function Pedidos({ onAbrir }) {
  const [pedidos, setPedidos] = useState(null)
  const [erro, setErro] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = searchParams.get('st') ?? ''

  useEffect(() => {
    listarPedidos().then(setPedidos, (error) => {
      console.error('carregar pedidos falhou:', error)
      setErro(true)
    })
  }, [])

  function mudarFiltro(valor) {
    const params = new URLSearchParams(searchParams)
    if (valor) params.set('st', valor)
    else params.delete('st')
    setSearchParams(params, { replace: true })
  }

  const contagem = useMemo(() => {
    const porEstado = {}
    for (const p of pedidos ?? []) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1
    return porEstado
  }, [pedidos])

  const filtros = [
    { valor: '', rotulo: 'Em aberto', n: ESTADOS_ABERTOS.reduce((s, e) => s + (contagem[e] ?? 0), 0) },
    ...ESTADOS_PEDIDO.map((e) => ({ valor: e.valor, rotulo: e.rotulo, n: contagem[e.valor] ?? 0 })),
    { valor: 'todos', rotulo: 'Todos', n: pedidos?.length ?? 0 },
  ]

  const visiveis = (pedidos ?? []).filter((p) =>
    filtro === 'todos' ? true : filtro === '' ? ESTADOS_ABERTOS.includes(p.estado) : p.estado === filtro,
  )

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Pedidos de adesão</h2>
        <button type="button" className="admin-button-secondary" onClick={() => onAbrir('novo')}>
          Criar pedido à mão
        </button>
      </div>

      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {pedidos && (
        <>
          <div className="assoc-filtros" role="group" aria-label="Estado do pedido">
            {filtros.map((f) => (
              <button
                key={f.valor || 'abertos'}
                type="button"
                className="assoc-filtro"
                aria-pressed={filtro === f.valor}
                onClick={() => mudarFiltro(f.valor)}
              >
                {f.rotulo} <span className="assoc-filtro-n">{f.n}</span>
              </button>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <p>{pedidos.length === 0 ? 'Ainda não há pedidos de adesão.' : 'Nenhum pedido neste estado.'}</p>
          ) : (
            <ul className="assoc-lista">
              {visiveis.map((p) => (
                <li key={p.id}>
                  <button type="button" className="assoc-linha" onClick={() => onAbrir(p.id)}>
                    <span className="assoc-linha-nome">{p.nome_completo}</span>
                    <span className="assoc-linha-detalhe">
                      {p.email} · pedido a {formatDate(dataBruxelas(p.data_pedido))}
                    </span>
                    <span>
                      <span className={`assoc-estado assoc-estado-${p.estado}`}>{rotulo(ESTADOS_PEDIDO, p.estado)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
