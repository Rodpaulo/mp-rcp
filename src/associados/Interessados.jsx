import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ListaMesa, { ItemMesa, PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { listarInteressados } from './api.js'
import { etapaInteressado, nomeDoInteressado } from './textos.js'

// Coluna da lista dos interessados (SPEC 16.16): primeira etapa do funil dos Associados.
// Filtros: '' = activos (sem pedido, por omissão), 'com-pedido', 'todos'.
export default function Interessados({ aberto, recarga, onAbrir }) {
  const [pessoas, setPessoas] = useState(null)
  const [erro, setErro] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = searchParams.get('st') ?? ''

  useEffect(() => {
    listarInteressados().then(
      (lidos) => {
        setPessoas(lidos)
        setErro(false)
      },
      (error) => {
        console.error('carregar interessados falhou:', error)
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

  const todos = pessoas ?? []
  const comPedido = todos.filter((i) => i.pedido).length
  const filtros = [
    { valor: '', rotulo: 'Activos', n: todos.length - comPedido },
    { valor: 'com-pedido', rotulo: 'Com pedido', n: comPedido },
    { valor: 'todos', rotulo: 'Todos', n: todos.length },
  ].map((f) => ({
    valor: f.valor,
    rotulo: (
      <>
        {f.rotulo} <span className="mesa-filtro-n">{f.n}</span>
      </>
    ),
  }))

  const visiveis = todos.filter((i) => (filtro === 'todos' ? true : filtro === 'com-pedido' ? i.pedido : !i.pedido))

  return (
    <ListaMesa titulo="Interessados">
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {pessoas && (
        <>
          <PilulasFiltro rotulo="Etapa do interessado" opcoes={filtros} valor={filtro} onMudar={mudarFiltro} />

          {visiveis.length === 0 ? (
            <p>{pessoas.length === 0 ? 'Ainda ninguém pediu para ser contactado.' : 'Nenhum interessado nesta etapa.'}</p>
          ) : (
            <ul className="mesa-itens">
              {visiveis.map((i) => {
                const etapa = etapaInteressado(i)
                return (
                  <ItemMesa
                    key={i.id}
                    aberto={i.id === aberto}
                    onAbrir={() => onAbrir(i.id)}
                    nome={nomeDoInteressado(i)}
                    detalhe={`${i.email} · interesse a ${formatDate(dataBruxelas(i.associado_interesse_at))}`}
                    pilula={<Pilula estado={etapa.estado}>{etapa.rotulo}</Pilula>}
                  />
                )
              })}
            </ul>
          )}
        </>
      )}
    </ListaMesa>
  )
}
