import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import {
  KEY_ASSOCIADO,
  KEY_EMAIL,
  KEY_LAST_EDITION,
  KEY_NEWSLETTER,
  readKey,
  removeKey,
  writeKey,
} from '../lib/storage.js'
import './CheckIn.css'

const TEXT = {
  ok: 'Bem-vindo/a de volta à Casa de Partida. Boa conversa.',
  already: 'Já estavas registado/a. Boa conversa.',
  invalid: 'Esse email não parece completo. Vê se não falta nada.',
  closed: 'Não há nenhuma edição aberta neste momento.',
  error: 'Não conseguimos registar agora. Tenta outra vez daqui a um minuto, ou diz à organização.',
  saved: 'Guardado',
}

const LABEL_NEWSLETTER = 'Quero receber a newsletter da Matinés Pensantes.'
const LABEL_ASSOCIADO = 'Quero ser associado da Matinés Pensantes. Contactem-me.'

// check_in_associado faz o mesmo que check_in e marca o interesse em ser associado (migração 006).
// É idempotente: repetir não duplica a presença, e o consentimento só sobe.
async function sendCheckIn(email, newsletter, associado) {
  const { data, error } = await supabase.rpc('check_in_associado', {
    p_email: email,
    p_newsletter: newsletter,
    p_associado_interesse: associado,
  })
  if (error) throw error
  return data
}

function rememberBoxes(newsletter, associado) {
  if (newsletter) writeKey(KEY_NEWSLETTER, '1')
  if (associado) writeKey(KEY_ASSOCIADO, '1')
}

function LibraryButton() {
  return (
    <Link className="checkin-library" to="/biblioteca">
      Biblioteca Circulante
    </Link>
  )
}

// Ecrã de confirmação: as duas caixas continuam à mão, porque muita gente só decide a meio do encontro.
// Uma caixa marcada fica marcada e fechada (o consentimento só sobe; retirar faz-se por email).
function LaterBoxes({ email }) {
  const [newsletter, setNewsletter] = useState(() => readKey(KEY_NEWSLETTER) === '1')
  const [associado, setAssociado] = useState(() => readKey(KEY_ASSOCIADO) === '1')
  const [sending, setSending] = useState(null) // 'newsletter' | 'associado' | null
  const [saved, setSaved] = useState([]) // caixas gravadas neste ecrã, para mostrar "Guardado"
  const [message, setMessage] = useState('')

  async function handleMark(box) {
    const next = { newsletter, associado, [box]: true }
    const setBox = box === 'newsletter' ? setNewsletter : setAssociado
    setBox(true)
    setSending(box)
    setMessage('')
    try {
      const data = await sendCheckIn(email, next.newsletter, next.associado)
      if (data?.status !== 'ok' && data?.status !== 'already') {
        throw new Error(`resposta inesperada de check_in: ${JSON.stringify(data)}`)
      }
      rememberBoxes(next.newsletter, next.associado)
      setSaved((list) => [...list, box])
    } catch (error) {
      console.error('gravar caixa falhou:', error)
      setBox(false)
      setMessage(TEXT.error)
    } finally {
      setSending(null)
    }
  }

  const boxes = [
    { key: 'newsletter', label: LABEL_NEWSLETTER, checked: newsletter },
    { key: 'associado', label: LABEL_ASSOCIADO, checked: associado },
  ]

  return (
    <div>
      {boxes.map((box) => (
        <label key={box.key} className="checkin-checkbox">
          <input
            type="checkbox"
            checked={box.checked}
            onChange={() => handleMark(box.key)}
            disabled={box.checked || sending !== null}
          />
          <span>
            {box.label}
            {saved.includes(box.key) && (
              <span className="checkin-saved" role="status">
                {' '}
                {TEXT.saved}
              </span>
            )}
          </span>
        </label>
      ))}
      {message && (
        <p className="checkin-message" role="alert">
          {message}
        </p>
      )}
    </div>
  )
}

export default function CheckIn() {
  // stage: 'loading' | 'form' | 'closed' | 'done'
  const [stage, setStage] = useState('loading')
  const [edition, setEdition] = useState(null)
  const [savedEmail, setSavedEmail] = useState(() => readKey(KEY_EMAIL))
  const [email, setEmail] = useState(() => readKey(KEY_EMAIL) ?? '')
  const [newsletter, setNewsletter] = useState(false)
  const [associado, setAssociado] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPrivacy, setShowPrivacy] = useState(false)

  useEffect(() => {
    let ignore = false

    supabase
      .rpc('open_edition')
      .then(({ data, error }) => {
        if (ignore) return
        if (error) throw error
        if (!data) {
          setStage('closed')
          return
        }
        setEdition(data)
        if (readKey(KEY_LAST_EDITION) === data.code) {
          setConfirmation(TEXT.already)
          setStage('done')
          return
        }
        setStage('form')
      })
      .catch((error) => {
        if (ignore) return
        // Sem a edição não há cabeçalho completo, mas o check_in ainda pode funcionar.
        console.error('open_edition falhou:', error)
        setStage('form')
      })

    return () => {
      ignore = true
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      setMessage(TEXT.invalid)
      return
    }

    setSending(true)
    setMessage('')
    try {
      const data = await sendCheckIn(normalized, newsletter, associado)

      if (data?.status === 'ok' || data?.status === 'already') {
        writeKey(KEY_EMAIL, normalized)
        writeKey(KEY_LAST_EDITION, data.edition)
        rememberBoxes(newsletter, associado)
        setSavedEmail(normalized)
        setConfirmation(data.status === 'ok' ? TEXT.ok : TEXT.already)
        setStage('done')
      } else if (data?.status === 'invalid_email') {
        setMessage(TEXT.invalid)
      } else if (data?.status === 'no_open_edition') {
        setStage('closed')
      } else {
        throw new Error(`resposta inesperada de check_in: ${JSON.stringify(data)}`)
      }
    } catch (error) {
      console.error('check_in falhou:', error)
      setMessage(TEXT.error)
    } finally {
      setSending(false)
    }
  }

  // Outra pessoa no mesmo telemóvel: esquece o email e as caixas da anterior.
  function handleClear() {
    removeKey(KEY_EMAIL)
    removeKey(KEY_LAST_EDITION)
    removeKey(KEY_NEWSLETTER)
    removeKey(KEY_ASSOCIADO)
    setSavedEmail(null)
    setEmail('')
    setMessage('')
  }

  return (
    <main className="checkin">
      <header className="checkin-header">
        <img className="checkin-logo" src="/logo-mp.png" alt="Matinés Pensantes" />
        <h1 className="checkin-title">Regresso à Casa de Partida</h1>
        {edition && (
          <p className="checkin-edition">
            {edition.title ? `${edition.code} · ${edition.title}` : edition.code}
          </p>
        )}
      </header>

      {stage === 'closed' && (
        <p className="checkin-notice" role="status">
          {TEXT.closed}
        </p>
      )}

      {stage === 'done' && (
        <>
          <p className="checkin-confirmation" role="status">
            {confirmation}
          </p>
          {savedEmail && <LaterBoxes email={savedEmail} />}
          <LibraryButton />
        </>
      )}

      {stage === 'form' && (
        <form className="checkin-form" onSubmit={handleSubmit} noValidate>
          <label className="checkin-label" htmlFor="checkin-email">
            O teu email
          </label>
          <input
            id="checkin-email"
            className="checkin-input"
            type="email"
            name="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            inputMode="email"
            placeholder="O teu email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={sending}
          />
          {savedEmail && (
            <button type="button" className="checkin-link checkin-clear" onClick={handleClear}>
              Não és tu? Limpar
            </button>
          )}

          <label className="checkin-checkbox">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(event) => setNewsletter(event.target.checked)}
              disabled={sending}
            />
            <span>{LABEL_NEWSLETTER}</span>
          </label>

          <label className="checkin-checkbox">
            <input
              type="checkbox"
              checked={associado}
              onChange={(event) => setAssociado(event.target.checked)}
              disabled={sending}
            />
            <span>{LABEL_ASSOCIADO}</span>
          </label>

          {message && (
            <p className="checkin-message" role="alert">
              {message}
            </p>
          )}

          <button type="submit" className="checkin-button" disabled={sending}>
            {sending ? 'Um momento…' : 'Estou cá'}
          </button>

          <LibraryButton />
        </form>
      )}

      {stage !== 'loading' && (
        <footer className="checkin-footer">
          <button
            type="button"
            className="checkin-link"
            aria-expanded={showPrivacy}
            aria-controls="checkin-privacy"
            onClick={() => setShowPrivacy((open) => !open)}
          >
            Como tratamos os teus dados
          </button>
          {showPrivacy && (
            <p id="checkin-privacy" className="checkin-privacy">
              A Matinés Pensantes (geral@matinespensantes.org) regista o teu email para saber quem
              esteve presente nos seus encontros. Só te enviamos a newsletter se marcares a caixa. Se marcares a
              caixa de associado, guardamos esse pedido para te contactarmos sobre a adesão. Os
              dados ficam numa base de dados na União Europeia, enquanto a associação organizar o
              Regresso à Casa de Partida. Para consultar ou apagar os teus dados, escreve-nos para
              geral@matinespensantes.org.
            </p>
          )}
        </footer>
      )}
    </main>
  )
}
