import { useEffect, useState } from 'react'
import { ItemMesa } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR } from '../admin/text.js'
import { porExtenso } from './datas.js'
import { listarPorRever } from './api.js'
import { ESTADOS, rotulo } from './listas.js'

// Contactos não encerrados com a próxima revisão por marcar ou vencida (vista rede_por_rever).
export default function PorRever({ aberto, recarga, onAbrir, onRever }) {
  const [contactos, setContactos] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    listarPorRever().then(
      (lidos) => {
        setContactos(lidos)
        setErro(false)
      },
      (error) => {
        console.error('carregar por rever falhou:', error)
        setErro(true)
      },
    )
  }, [recarga])

  return (
    <>
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {contactos &&
        (contactos.length === 0 ? (
          <p>Não há contactos por rever.</p>
        ) : (
          <ul className="mesa-itens">
            {contactos.map((contacto) => (
              <ItemMesa
                key={contacto.id}
                aberto={contacto.id === aberto}
                onAbrir={() => onAbrir(contacto.id)}
                nome={contacto.nome}
                detalhe={
                  (contacto.proxima_revisao
                    ? `Revisão prevista para ${porExtenso(contacto.proxima_revisao)}`
                    : 'Revisão por marcar') +
                  (contacto.ultima_revisao ? ` · última a ${porExtenso(contacto.ultima_revisao)}` : '')
                }
                pilula={<Pilula estado={contacto.estado}>{rotulo(ESTADOS, contacto.estado)}</Pilula>}
              >
                <button type="button" className="mesa-item-accao" onClick={() => onRever(contacto.id)}>
                  Registar revisão
                </button>
              </ItemMesa>
            ))}
          </ul>
        ))}
    </>
  )
}
