import { useSearchParams } from 'react-router-dom'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import { PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Mesa from '../admin/mesa/Mesa.jsx'
import AssociadoFicha from './AssociadoFicha.jsx'
import Configuracao from './Configuracao.jsx'
import EmailsEnviados from './EmailsEnviados.jsx'
import EmailsTipo from './EmailsTipo.jsx'
import EmailTipoForm from './EmailTipoForm.jsx'
import ListaAssociados from './ListaAssociados.jsx'
import PedidoFicha from './PedidoFicha.jsx'
import PedidoForm from './PedidoForm.jsx'
import Pedidos from './Pedidos.jsx'
import './Associados.css'

const VISTAS = [
  { valor: '', rotulo: 'Pedidos' },
  { valor: 'associados', rotulo: 'Associados' },
  { valor: 'emails', rotulo: 'Emails-tipo' },
  { valor: 'enviados', rotulo: 'Emails enviados' },
  { valor: 'config', rotulo: 'Configuração' },
]

// Navegação dos Associados por parâmetros no endereço (SPEC 16.15):
//   ?s=associados                 pedidos (por omissão, os em aberto); &st=<estado> filtra
//   ?s=associados&p=novo          criar pedido à mão
//   ?s=associados&p=<id>          ficha do pedido
//   ?s=associados&v=associados    associados
//   ?s=associados&a=<id>          ficha do associado
//   ?s=associados&v=emails        emails-tipo
//   ?s=associados&e=<chave>       editar email-tipo, com pré-visualização
//   ?s=associados&v=enviados      últimos 100 envios
//   ?s=associados&v=config        configuração
// Pedidos e associados em mesa de trabalho (SPEC 17.4): a ficha do pedido fica ao lado da lista
// dos pedidos (com o mesmo st), a do associado ao lado da lista dos associados (v=associados).
// Emails-tipo, Emails enviados e Configuração em largura total.
export default function Associados() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pedido = searchParams.get('p')
  const associado = searchParams.get('a')
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
  const mudarVista = (valor) => irPara(valor ? { v: valor } : {})

  // Pedidos ou associados: a lista que acompanha a ficha.
  const naMesa = associado || vista === 'associados' ? 'associados' : pedido || vista === '' ? 'pedidos' : null
  const recarga = `${pedido ?? ''}|${associado ?? ''}`

  const vistas = (
    <PilulasFiltro
      rotulo="Vistas dos Associados"
      opcoes={VISTAS}
      valor={naMesa === 'associados' ? 'associados' : naMesa === 'pedidos' ? '' : vista}
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
            <EmailsEnviados onAbrirPedido={(id) => abrirPedido(id)} onAbrirAssociado={abrirAssociado} />
          )}
          {vista === 'config' && <Configuracao />}
        </div>
      </>
    )
  }

  const lista =
    naMesa === 'pedidos' ? (
      <Pedidos
        aberto={pedido}
        recarga={recarga}
        onAbrir={(id) => (id === 'novo' ? irPara({ ...comFiltro, p: 'novo' }) : abrirPedido(id))}
      />
    ) : (
      <ListaAssociados aberto={associado} recarga={recarga} onAbrir={abrirAssociado} />
    )

  let ficha
  if (pedido === 'novo') {
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
          {naMesa === 'pedidos' ? 'Escolhe um pedido na lista.' : 'Escolhe um associado na lista.'}
        </p>
      </FichaCartao>
    )
  }

  return (
    <>
      {vistas}
      <Mesa aberto={Boolean(pedido || associado)} lista={lista}>
        {ficha}
      </Mesa>
    </>
  )
}
