import { useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { listarEmailsTipo } from './api.js'
import { MANUAIS, numeroEmail } from './textos.js'

export default function EmailsTipo({ onAbrir }) {
  const [tipos, setTipos] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    listarEmailsTipo().then(setTipos, (error) => {
      console.error('carregar emails-tipo falhou:', error)
      setErro(true)
    })
  }, [])

  return (
    <section className="admin-section">
      <h2>Emails-tipo</h2>
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {tipos && (
        <ul className="assoc-lista">
          {tipos.map((t) => (
            <li key={t.chave}>
              <button type="button" className="assoc-linha" onClick={() => onAbrir(t.chave)}>
                <span className="assoc-linha-nome">
                  {numeroEmail(t.chave)}. {t.nome}
                </span>
                {t.quando && <span className="assoc-linha-detalhe">{t.quando}</span>}
                <span>
                  <span className={`assoc-estado ${MANUAIS.includes(t.chave) ? 'assoc-envio-manual' : 'assoc-envio-auto'}`}>
                    {MANUAIS.includes(t.chave) ? 'Manual' : 'Automático'}
                  </span>
                  {!t.activo && <span className="assoc-estado assoc-estado-cancelado"> Inactivo</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
