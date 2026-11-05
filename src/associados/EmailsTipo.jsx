import { useEffect, useState } from 'react'
import { ItemMesa } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
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
        <ul className="mesa-itens">
          {tipos.map((t) => (
            <ItemMesa
              key={t.chave}
              onAbrir={() => onAbrir(t.chave)}
              nome={`${numeroEmail(t.chave)}. ${t.nome}`}
              detalhe={t.quando}
              pilula={
                <span className="mesa-pilulas">
                  <Pilula>{MANUAIS.includes(t.chave) ? 'Manual' : 'Automático'}</Pilula>
                  {!t.activo && <Pilula estado="cancelado">Inactivo</Pilula>}
                </span>
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}
