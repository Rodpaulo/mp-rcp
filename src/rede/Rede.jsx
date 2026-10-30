import { useSearchParams } from 'react-router-dom'
import Contactos from './Contactos.jsx'
import ContactoForm from './ContactoForm.jsx'
import Ficha from './Ficha.jsx'
import InteraccaoForm from './InteraccaoForm.jsx'
import RevisaoForm from './RevisaoForm.jsx'
import './Rede.css'

// Navegação do Rede por parâmetros no endereço, para o "Voltar" do telemóvel funcionar:
//   ?s=rede                       lista de contactos
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

  return <Contactos onAbrir={(id) => (id === 'novo' ? irPara({ c: 'novo' }) : ficha(id))} />
}
