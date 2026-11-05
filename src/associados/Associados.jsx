import { Link, useSearchParams } from 'react-router-dom'
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

function Vistas({ actual }) {
  return (
    <nav className="assoc-vistas" aria-label="Vistas dos Associados">
      {VISTAS.map((vista) => (
        <Link
          key={vista.valor}
          to={vista.valor ? `/admin?s=associados&v=${vista.valor}` : '/admin?s=associados'}
          className="assoc-vista"
          aria-current={actual === vista.valor ? 'page' : undefined}
        >
          {vista.rotulo}
        </Link>
      ))}
    </nav>
  )
}

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
export default function Associados() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pedido = searchParams.get('p')
  const associado = searchParams.get('a')
  const email = searchParams.get('e')

  function irPara(params, opcoes) {
    setSearchParams({ s: 'associados', ...params }, opcoes)
  }

  const abrirPedido = (id, opcoes) => irPara({ p: id }, opcoes)
  const abrirAssociado = (id) => irPara({ a: id })

  if (pedido === 'novo') {
    return <PedidoForm onVoltar={() => irPara({})} onGravado={(id) => abrirPedido(id, { replace: true })} />
  }

  if (pedido) {
    return (
      <PedidoFicha
        key={pedido}
        id={pedido}
        onLista={() => irPara({})}
        onAbrirAssociado={abrirAssociado}
      />
    )
  }

  if (associado) {
    return (
      <AssociadoFicha
        key={associado}
        id={associado}
        onLista={() => irPara({ v: 'associados' })}
        onAbrirPedido={(id) => abrirPedido(id)}
      />
    )
  }

  if (email) {
    return <EmailTipoForm key={email} chave={email} onVoltar={() => irPara({ v: 'emails' })} />
  }

  const vista = VISTAS.some((item) => item.valor === searchParams.get('v')) ? searchParams.get('v') : ''

  return (
    <>
      <Vistas actual={vista} />
      {vista === '' && <Pedidos onAbrir={(id) => (id === 'novo' ? irPara({ p: 'novo' }) : abrirPedido(id))} />}
      {vista === 'associados' && <ListaAssociados onAbrir={abrirAssociado} />}
      {vista === 'emails' && <EmailsTipo onAbrir={(chave) => irPara({ e: chave })} />}
      {vista === 'enviados' && (
        <EmailsEnviados onAbrirPedido={(id) => abrirPedido(id)} onAbrirAssociado={abrirAssociado} />
      )}
      {vista === 'config' && <Configuracao />}
    </>
  )
}
