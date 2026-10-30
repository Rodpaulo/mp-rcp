import { useSearchParams } from 'react-router-dom'
import Contactos from './Contactos.jsx'
import ContactoForm from './ContactoForm.jsx'
import './Rede.css'

// Navegação do Rede por parâmetros no endereço, para o "Voltar" do telemóvel funcionar:
//   ?s=rede            lista de contactos
//   ?s=rede&c=novo     contacto novo
//   ?s=rede&c=<id>     editar contacto
export default function Rede() {
  const [searchParams, setSearchParams] = useSearchParams()
  const contacto = searchParams.get('c')

  function irPara(params) {
    setSearchParams({ s: 'rede', ...params })
  }

  if (contacto) {
    return (
      <ContactoForm
        key={contacto}
        id={contacto === 'novo' ? null : contacto}
        onVoltar={() => irPara({})}
      />
    )
  }

  return <Contactos onAbrir={(id) => irPara({ c: id })} />
}
