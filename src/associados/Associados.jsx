import { useSearchParams } from 'react-router-dom'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import { VistasMesa } from '../admin/mesa/ListaMesa.jsx'
import Mesa from '../admin/mesa/Mesa.jsx'
import AssociadoFicha from './AssociadoFicha.jsx'
import Configuracao from './Configuracao.jsx'
import EmailsEnviados from './EmailsEnviados.jsx'
import EmailsTipo from './EmailsTipo.jsx'
import EmailTipoForm from './EmailTipoForm.jsx'
import InteressadoFicha from './InteressadoFicha.jsx'
import Interessados from './Interessados.jsx'
import ListaAssociados from './ListaAssociados.jsx'
import PedidoFicha from './PedidoFicha.jsx'
import PedidoForm from './PedidoForm.jsx'
import Recibos from './Recibos.jsx'
import Pedidos from './Pedidos.jsx'
import './Associados.css'

const VISTAS = [
  { valor: 'interessados', rotulo: 'Interessados' },
  { valor: '', rotulo: 'Pedidos' },
  { valor: 'associados', rotulo: 'Associados' },
  { valor: 'recibos', rotulo: 'Recibos' },
  { valor: 'emails', rotulo: 'Emails-tipo' },
  { valor: 'enviados', rotulo: 'Emails enviados' },
  { valor: 'config', rotulo: 'Configuração' },
]

// Navegação dos Associados por parâmetros no endereço (SPEC 16.15, 16.16):
//   ?s=associados&v=interessados  interessados (por omissão, os sem pedido); &st=com-pedido|todos filtra
//   ?s=associados&i=<person_id>   ficha do interessado
//   ?s=associados                 pedidos (por omissão, os em aberto); &st=<estado> filtra
//   ?s=associados&p=novo          criar pedido à mão
//   ?s=associados&p=<id>          ficha do pedido
//   ?s=associados&v=associados    associados
//   ?s=associados&a=<id>          ficha do associado
//   ?s=associados&v=recibos       recibos, por ano, com "Exportar ano" (SPEC 16.17)
//   ?s=associados&v=emails        emails-tipo
//   ?s=associados&e=<chave>       editar email-tipo, com pré-visualização
//   ?s=associados&v=enviados      últimos 100 envios
//   ?s=associados&v=config        configuração
// Interessados, pedidos e associados em mesa de trabalho (SPEC 17.4): cada ficha ao lado da sua lista
// (o interessado com o mesmo st, v=interessados; o pedido com o mesmo st; o associado com v=associados).
// Recibos, Emails-tipo, Emails enviados e Configuração em largura total.
export default function Associados() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pedido = searchParams.get('p')
  const associado = searchParams.get('a')
  const interessado = searchParams.get('i')
  const email = searchParams.get('e')
  const filtro = searchParams.get('st')
  const vParam = searchParams.get('v')
  const vista = VISTAS.some((item) => item.valor === vParam) ? vParam : ''

  function irPara(params, opcoes) {
    setSearchParams({ s: 'associados', ...params }, opcoes)
  }

  const comFiltro = filtro ? { st: filtro } : {}
  const listaPedidos = (opcoes) => irPara(comFiltro, opcoes)
  const abrirPedido = (id, opcoes) => irPara({ ...comFiltro, p: id }, opcoes)
  const abrirAssociado = (id) => irPara({ v: 'associados', a: id })
  const listaInteressados = () => irPara({ v: 'interessados', ...comFiltro })
  const abrirInteressado = (id) => irPara({ v: 'interessados', ...comFiltro, i: id })
  const mudarVista = (valor) => irPara(valor ? { v: valor } : {})

  // Interessados, pedidos ou associados: a lista que acompanha a ficha.
  const naMesa =
    interessado || vista === 'interessados'
      ? 'interessados'
      : associado || vista === 'associados'
        ? 'associados'
        : pedido || vista === ''
          ? 'pedidos'
          : null
  const recarga = `${pedido ?? ''}|${associado ?? ''}|${interessado ?? ''}`

  const vistas = (
    <VistasMesa
      rotulo="Vistas dos Associados"
      opcoes={VISTAS}
      valor={naMesa === 'interessados' || naMesa === 'associados' ? naMesa : naMesa === 'pedidos' ? '' : vista}
      onMudar={mudarVista}
    />
  )

  if (email) {
    return (
      <>
        {vistas}
        <div className="mesa-largo">
          <EmailTipoForm key={email} chave={email} onVoltar={() => irPara({ v: 'emails' })} />
        </div>
      </>
    )
  }

  if (!naMesa) {
    return (
      <>
        {vistas}
        <div className="mesa-largo">
          {vista === 'emails' && <EmailsTipo onAbrir={(chave) => irPara({ e: chave })} />}
          {vista === 'enviados' && (
            <EmailsEnviados
              onAbrirPedido={(id) => abrirPedido(id)}
              onAbrirAssociado={abrirAssociado}
              onAbrirInteressado={(id) => irPara({ v: 'interessados', st: 'todos', i: id })}
            />
          )}
          {vista === 'recibos' && <Recibos onAbrirAssociado={abrirAssociado} />}
          {vista === 'config' && <Configuracao />}
        </div>
      </>
    )
  }

  const lista =
    naMesa === 'interessados' ? (
      <Interessados aberto={interessado} recarga={recarga} onAbrir={abrirInteressado} />
    ) : naMesa === 'pedidos' ? (
      <Pedidos
        aberto={pedido}
        recarga={recarga}
        onAbrir={(id) => (id === 'novo' ? irPara({ ...comFiltro, p: 'novo' }) : abrirPedido(id))}
      />
    ) : (
      <ListaAssociados aberto={associado} recarga={recarga} onAbrir={abrirAssociado} />
    )

  let ficha
  if (interessado) {
    ficha = (
      <InteressadoFicha
        key={interessado}
        id={interessado}
        onLista={listaInteressados}
        onAbrirPedido={(id) => irPara({ p: id })}
      />
    )
  } else if (pedido === 'novo') {
    ficha = <PedidoForm onVoltar={() => listaPedidos()} onGravado={(id) => abrirPedido(id, { replace: true })} />
  } else if (pedido) {
    ficha = (
      <PedidoFicha key={pedido} id={pedido} onLista={() => listaPedidos()} onAbrirAssociado={abrirAssociado} />
    )
  } else if (associado) {
    ficha = (
      <AssociadoFicha
        key={associado}
        id={associado}
        onLista={() => irPara({ v: 'associados' })}
        onAbrirPedido={(id) => irPara({ p: id })}
      />
    )
  } else {
    ficha = (
      <FichaCartao>
        <p className="mesa-vazio">
          {naMesa === 'interessados'
            ? 'Escolhe um interessado na lista.'
            : naMesa === 'pedidos'
              ? 'Escolhe um pedido na lista.'
              : 'Escolhe um associado na lista.'}
        </p>
      </FichaCartao>
    )
  }

  return (
    <>
      {vistas}
      <Mesa aberto={Boolean(pedido || associado || interessado)} lista={lista}>
        {ficha}
      </Mesa>
    </>
  )
}
