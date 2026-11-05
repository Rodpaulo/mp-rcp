import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ListaMesa, { ItemMesa, PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { ESTADOS_ABERTOS, listarPedidos } from './api.js'
import { ESTADOS_PEDIDO, rotulo } from './textos.js'

// Coluna da lista dos pedidos. Filtros: '' = em aberto (por omissão), 'todos', ou um estado.
// recarga muda quando se abre, grava ou fecha um pedido.
export default function Pedidos({ aberto, recarga, onAbrir }) {
  const [pedidos, setPedidos] = useState(null)
  const [erro, setErro] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = searchParams.get('st') ?? ''

  useEffect(() => {
    listarPedidos().then(
      (lidos) => {
        setPedidos(lidos)
        setErro(false)
      },
      (error) => {
        console.error('carregar pedidos falhou:', error)
        setErro(true)
      },
    )
  }, [recarga])

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

  // "Em aberto" e "Todos" sempre; cada estado só quando tem pedidos (ou está escolhido).
  const filtros = [
    { valor: '', rotulo: 'Em aberto', n: ESTADOS_ABERTOS.reduce((s, e) => s + (contagem[e] ?? 0), 0) },
    ...ESTADOS_PEDIDO.map((e) => ({ valor: e.valor, rotulo: e.rotulo, n: contagem[e.valor] ?? 0 })).filter(
      (f) => f.n > 0 || f.valor === filtro,
    ),
    { valor: 'todos', rotulo: 'Todos', n: pedidos?.length ?? 0 },
  ].map((f) => ({
    valor: f.valor,
    rotulo: (
      <>
        {f.rotulo} <span className="mesa-filtro-n">{f.n}</span>
      </>
    ),
  }))

  const visiveis = (pedidos ?? []).filter((p) =>
    filtro === 'todos' ? true : filtro === '' ? ESTADOS_ABERTOS.includes(p.estado) : p.estado === filtro,
  )

  return (
    <ListaMesa
      titulo="Pedidos de adesão"
      accao={
        <button type="button" className="mesa-ligacao" onClick={() => onAbrir('novo')}>
          Criar pedido à mão
        </button>
      }
    >
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {pedidos && (
        <>
          <PilulasFiltro rotulo="Estado do pedido" opcoes={filtros} valor={filtro} onMudar={mudarFiltro} />

          {visiveis.length === 0 ? (
            <p>{pedidos.length === 0 ? 'Ainda não há pedidos de adesão.' : 'Nenhum pedido neste estado.'}</p>
          ) : (
            <ul className="mesa-itens">
              {visiveis.map((p) => (
                <ItemMesa
                  key={p.id}
                  aberto={p.id === aberto}
                  onAbrir={() => onAbrir(p.id)}
                  nome={p.nome_completo}
                  detalhe={`${p.email} · pedido a ${formatDate(dataBruxelas(p.data_pedido))}`}
                  pilula={<Pilula estado={p.estado}>{rotulo(ESTADOS_PEDIDO, p.estado)}</Pilula>}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </ListaMesa>
  )
}
