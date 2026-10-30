import { Link, useSearchParams } from 'react-router-dom'
import AccoesEmAtraso from './AccoesEmAtraso.jsx'
import Contactos from './Contactos.jsx'
import ContactoForm from './ContactoForm.jsx'
import Ficha from './Ficha.jsx'
import InteraccaoForm from './InteraccaoForm.jsx'
import PorRever from './PorRever.jsx'
import RevisaoForm from './RevisaoForm.jsx'
import './Rede.css'

const VISTAS = [
  { valor: '', rotulo: 'Contactos' },
  { valor: 'por-rever', rotulo: 'Por rever' },
  { valor: 'atraso', rotulo: 'Acções em atraso' },
]

function Vistas({ actual }) {
  return (
    <nav className="rede-vistas" aria-label="Vistas do Rede">
      {VISTAS.map((vista) => (
        <Link
          key={vista.valor}
          to={vista.valor ? `/admin?s=rede&v=${vista.valor}` : '/admin?s=rede'}
          className="rede-vista"
          aria-current={actual === vista.valor ? 'page' : undefined}
        >
          {vista.rotulo}
        </Link>
      ))}
    </nav>
  )
}

// Navegação do Rede por parâmetros no endereço, para o "Voltar" do telemóvel funcionar:
//   ?s=rede                       lista de contactos
//   ?s=rede&v=por-rever           vista "Por rever"
//   ?s=rede&v=atraso              vista "Acções em atraso"
//   ?s=rede&c=novo                contacto novo
//   ?s=rede&c=<id>                ficha do contacto
//   ?s=rede&c=<id>&m=editar       editar contacto
//   ?s=rede&c=<id>&m=interaccao   registar interacção
//   ?s=rede&c=<id>&m=revisao      registar revisão
export default function Rede() {
  const [searchParams, setSearchParams] = useSearchParams()
  const contacto = searchParams.get('c')
  const modo = searchParams.get('m')

  function irPara(params, opcoes) {
    setSearchParams({ s: 'rede', ...params }, opcoes)
  }

  const lista = () => irPara({})
  // Depois de gravar, substitui o formulário no histórico: o "Voltar" não reabre um formulário já gravado.
  const ficha = (id, opcoes) => irPara({ c: id }, opcoes)

  if (contacto === 'novo') {
    return <ContactoForm key="novo" id={null} onVoltar={lista} onGravado={(id) => ficha(id, { replace: true })} />
  }

  if (contacto && modo === 'editar') {
    return (
      <ContactoForm
        key={contacto}
        id={contacto}
        onVoltar={() => ficha(contacto)}
        onGravado={() => ficha(contacto, { replace: true })}
      />
    )
  }

  if (contacto && modo === 'interaccao') {
    return (
      <InteraccaoForm
        contactoId={contacto}
        onVoltar={() => ficha(contacto)}
        onGravado={() => ficha(contacto, { replace: true })}
      />
    )
  }

  if (contacto && modo === 'revisao') {
    return (
      <RevisaoForm
        contactoId={contacto}
        onVoltar={() => ficha(contacto)}
        onGravado={() => ficha(contacto, { replace: true })}
      />
    )
  }

  if (contacto) {
    return (
      <Ficha
        key={contacto}
        id={contacto}
        onLista={lista}
        onAbrir={(id) => ficha(id)}
        onModo={(novoModo) => irPara({ c: contacto, m: novoModo })}
        onApagado={() => irPara({}, { replace: true })}
      />
    )
  }

  const vista = VISTAS.some((item) => item.valor === searchParams.get('v')) ? searchParams.get('v') : ''

  return (
    <>
      <Vistas actual={vista} />
      {vista === 'por-rever' && (
        <PorRever onAbrir={(id) => ficha(id)} onRever={(id) => irPara({ c: id, m: 'revisao' })} />
      )}
      {vista === 'atraso' && <AccoesEmAtraso onAbrir={(id) => ficha(id)} />}
      {vista === '' && <Contactos onAbrir={(id) => (id === 'novo' ? irPara({ c: 'novo' }) : ficha(id))} />}
    </>
  )
}
