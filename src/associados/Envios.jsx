import { useState } from 'react'
import { formatDate, formatTime } from '../admin/text.js'
import { dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { libertarEnvio } from './api.js'
import Pilula from '../admin/mesa/Pilula.jsx'
import { ESTADOS_ENVIO, numeroEmail, rotulo } from './textos.js'

const DEZ_MINUTOS = 10 * 60 * 1000

function quando(instante) {
  return `${formatDate(dataBruxelas(instante))}, ${formatTime(instante)}`
}

// Lista de envios: na ficha do pedido, na do associado e na vista "Emails enviados".
// `destino(envio)` devolve, se quiser, um botão para o pedido ou o associado.
export default function Envios({ envios, destino, onMudou }) {
  const [aLibertar, setALibertar] = useState(null)
  const [erro, setErro] = useState(false)
  // A hora em que a lista abriu: decide que reservas a_enviar já estão presas.
  const [abertaEm] = useState(() => Date.now())

  async function libertar(id) {
    setALibertar(id)
    setErro(false)
    try {
      await libertarEnvio(id)
      onMudou?.()
    } catch (error) {
      console.error('libertar envio falhou:', error)
      setErro(true)
    } finally {
      setALibertar(null)
    }
  }

  if (envios.length === 0) return <p>Ainda não há emails registados.</p>

  return (
    <>
      {erro && (
        <p className="admin-error" role="alert">
          Não foi possível libertar. Tenta outra vez.
        </p>
      )}
      <ul className="assoc-envios">
        {envios.map((e) => (
          <li key={e.id} className={`assoc-envio assoc-envio-${e.estado}`}>
            <p className="assoc-envio-cabeca">
              <Pilula estado={e.estado}>{rotulo(ESTADOS_ENVIO, e.estado)}</Pilula>{' '}
              Email {numeroEmail(e.email_tipo)}
              {e.periodo && ` (${e.periodo})`} · {quando(e.enviado_em)}
            </p>
            <p className="assoc-envio-assunto">{e.assunto}</p>
            <p className="assoc-linha-detalhe">
              Para {e.destinatario}
              {destino && <> · {destino(e)}</>}
            </p>
            {e.estado !== 'enviado' && e.resposta_provider && <p className="assoc-envio-erro">{e.resposta_provider}</p>}
            {e.estado === 'enviado' && e.resposta_provider === 'Registado à mão no admin' && (
              <p className="assoc-linha-detalhe">Registado à mão no admin.</p>
            )}
            {e.estado === 'a_enviar' && abertaEm - new Date(e.enviado_em).getTime() > DEZ_MINUTOS && (
              <button
                type="button"
                className="admin-button-secondary"
                disabled={aLibertar === e.id}
                onClick={() => libertar(e.id)}
              >
                {aLibertar === e.id ? 'Um momento…' : 'Libertar'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
