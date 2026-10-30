import { useEffect, useState } from 'react'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { listarPorRever } from './api.js'
import { ESTADOS, rotulo } from './listas.js'

// Contactos não encerrados com a próxima revisão por marcar ou vencida (vista rede_por_rever).
export default function PorRever({ onAbrir, onRever }) {
  const [contactos, setContactos] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    listarPorRever().then(setContactos, (error) => {
      console.error('carregar por rever falhou:', error)
      setErro(true)
    })
  }, [])

  return (
    <section className="admin-section">
      <h2>Por rever</h2>
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {contactos &&
        (contactos.length === 0 ? (
          <p>Não há contactos por rever.</p>
        ) : (
          <ul className="rede-historico">
            {contactos.map((contacto) => (
              <li key={contacto.id}>
                <p className="rede-historico-cabeca">
                  <button type="button" className="rede-ligacao-texto" onClick={() => onAbrir(contacto.id)}>
                    {contacto.nome}
                  </button>{' '}
                  <span className={`rede-estado rede-estado-${contacto.estado}`}>{rotulo(ESTADOS, contacto.estado)}</span>
                </p>
                <p className="rede-historico-pe">
                  {contacto.proxima_revisao
                    ? `Revisão prevista para ${formatDate(contacto.proxima_revisao)}`
                    : 'Revisão por marcar'}
                  {contacto.ultima_revisao && ` · última a ${formatDate(contacto.ultima_revisao)}`}
                </p>
                <button type="button" className="admin-button-secondary rede-botao-lista" onClick={() => onRever(contacto.id)}>
                  Registar revisão
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
