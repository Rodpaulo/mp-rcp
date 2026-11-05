import { useSearchParams } from 'react-router-dom'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import ListaMesa, { PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Mesa from '../admin/mesa/Mesa.jsx'
import AccoesEmAtraso from './AccoesEmAtraso.jsx'
import Contactos from './Contactos.jsx'
import ContactoForm from './ContactoForm.jsx'
import Ficha from './Ficha.jsx'
import InteraccaoForm from './InteraccaoForm.jsx'
import Interessados from './Interessados.jsx'
import PorRever from './PorRever.jsx'
import RevisaoForm from './RevisaoForm.jsx'
import './Rede.css'

// As quatro vistas são pílulas da coluna da lista (SPEC 17.4).
const VISTAS = [
  { valor: '', rotulo: 'Contactos' },
  { valor: 'por-rever', rotulo: 'Por rever' },
  { valor: 'atraso', rotulo: 'Em atraso' },
  { valor: 'interessados', rotulo: 'Interessados' },
]

// Parâmetros da lista: ficam quando se abre ou fecha um contacto, para a lista não mudar ao lado da ficha.
const DA_LISTA = ['v', 'q', 'e', 'st']

// Navegação do Rede por parâmetros no endereço, para o "Voltar" do telemóvel funcionar:
//   ?s=rede                       lista de contactos
//   ?s=rede&v=por-rever           vista "Por rever"
//   ?s=rede&v=atraso              vista "Acções em atraso"
//   ?s=rede&v=interessados        vista "Interessados" (quer ser associado)
//   ?s=rede&c=novo                contacto novo
//   ?s=rede&c=<id>                ficha do contacto
//   ?s=rede&c=<id>&m=editar       editar contacto
//   ?s=rede&c=<id>&m=interaccao   registar interacção
//   ?s=rede&c=<id>&m=revisao      registar revisão
// A lista fica à esquerda da ficha (no telemóvel, só a ficha), com os mesmos v, q, e e st.
export default function Rede() {
  const [searchParams, setSearchParams] = useSearchParams()
  const contacto = searchParams.get('c')
  const modo = searchParams.get('m')
  const vista = VISTAS.some((item) => item.valor === searchParams.get('v')) ? searchParams.get('v') : ''

  function irPara(params, opcoes) {
    const daLista = {}
    for (const chave of DA_LISTA) {
      if (searchParams.get(chave)) daLista[chave] = searchParams.get(chave)
    }
    setSearchParams({ s: 'rede', ...daLista, ...params }, opcoes)
  }

  function mudarVista(valor) {
    const params = new URLSearchParams(searchParams)
    if (valor) params.set('v', valor)
    else params.delete('v')
    setSearchParams(params)
  }

  const lista = () => irPara({})
  // Depois de gravar, substitui o formulário no histórico: o "Voltar" não reabre um formulário já gravado.
  const ficha = (id, opcoes) => irPara({ c: id }, opcoes)

  // A lista lê de novo quando se abre, grava ou fecha um contacto: nomes e estados ficam em dia.
  const recarga = `${contacto ?? ''}|${modo ?? ''}`

  const colunaLista = (
    <ListaMesa
      titulo="Rede"
      accao={
        <button type="button" className="mesa-botao" onClick={() => irPara({ c: 'novo' })}>
          Novo contacto
        </button>
      }
    >
      <PilulasFiltro rotulo="Vistas do Rede" opcoes={VISTAS} valor={vista} onMudar={mudarVista} />
      {vista === 'por-rever' && (
        <PorRever
          aberto={contacto}
          recarga={recarga}
          onAbrir={(id) => ficha(id)}
          onRever={(id) => irPara({ c: id, m: 'revisao' })}
        />
      )}
      {vista === 'atraso' && <AccoesEmAtraso aberto={contacto} recarga={recarga} onAbrir={(id) => ficha(id)} />}
      {vista === 'interessados' && <Interessados aberto={contacto} recarga={recarga} onAbrir={(id) => ficha(id)} />}
      {vista === '' && <Contactos aberto={contacto} recarga={recarga} onAbrir={(id) => ficha(id)} />}
    </ListaMesa>
  )

  let colunaFicha
  if (contacto === 'novo') {
    colunaFicha = (
      <ContactoForm key="novo" id={null} onVoltar={lista} onGravado={(id) => ficha(id, { replace: true })} />
    )
  } else if (contacto && modo === 'editar') {
    colunaFicha = (
      <ContactoForm
        key={contacto}
        id={contacto}
        onVoltar={() => ficha(contacto)}
        onGravado={() => ficha(contacto, { replace: true })}
      />
    )
  } else if (contacto && modo === 'interaccao') {
    colunaFicha = (
      <InteraccaoForm
        key={contacto}
        contactoId={contacto}
        onVoltar={() => ficha(contacto)}
        onGravado={() => ficha(contacto, { replace: true })}
      />
    )
  } else if (contacto && modo === 'revisao') {
    colunaFicha = (
      <RevisaoForm
        key={contacto}
        contactoId={contacto}
        onVoltar={() => ficha(contacto)}
        onGravado={() => ficha(contacto, { replace: true })}
      />
    )
  } else if (contacto) {
    colunaFicha = (
      <Ficha
        key={contacto}
        id={contacto}
        onLista={lista}
        onAbrir={(id) => ficha(id)}
        onModo={(novoModo) => irPara({ c: contacto, m: novoModo })}
        onApagado={() => irPara({}, { replace: true })}
      />
    )
  } else {
    colunaFicha = (
      <FichaCartao>
        <p className="mesa-vazio">Escolhe um contacto na lista.</p>
      </FichaCartao>
    )
  }

  return (
    <Mesa aberto={Boolean(contacto)} lista={colunaLista}>
      {colunaFicha}
    </Mesa>
  )
}
