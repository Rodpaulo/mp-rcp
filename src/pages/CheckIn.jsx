import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { KEY_EMAIL, KEY_LAST_EDITION, readKey, removeKey, writeKey } from '../lib/storage.js'
import './CheckIn.css'

const TEXT = {
  ok: 'Bem-vindo/a de volta à Casa de Partida. Boa conversa.',
  already: 'Já estavas registado/a. Boa conversa.',
  invalid: 'Esse email não parece completo. Vê se não falta nada.',
  closed: 'Não há nenhuma edição aberta neste momento.',
  error: 'Não conseguimos registar agora. Tenta outra vez daqui a um minuto, ou diz à organização.',
}

export default function CheckIn() {
  // stage: 'loading' | 'form' | 'closed' | 'done'
  const [stage, setStage] = useState('loading')
  const [edition, setEdition] = useState(null)
  const [savedEmail, setSavedEmail] = useState(() => readKey(KEY_EMAIL))
  const [email, setEmail] = useState(() => readKey(KEY_EMAIL) ?? '')
  const [newsletter, setNewsletter] = useState(false)
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
      const { data, error } = await supabase.rpc('check_in', {
        p_email: normalized,
        p_newsletter: newsletter,
      })
      if (error) throw error

      if (data?.status === 'ok' || data?.status === 'already') {
        writeKey(KEY_EMAIL, normalized)
        writeKey(KEY_LAST_EDITION, data.edition)
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

  function handleClear() {
    removeKey(KEY_EMAIL)
    removeKey(KEY_LAST_EDITION)
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
          <Link className="checkin-library" to="/biblioteca">
            Biblioteca Circulante →
          </Link>
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
            <span>Quero receber a newsletter da Matinés Pensantes.</span>
          </label>

          {message && (
            <p className="checkin-message" role="alert">
              {message}
            </p>
          )}

          <button type="submit" className="checkin-button" disabled={sending}>
            {sending ? 'Um momento…' : 'Estou cá'}
          </button>

          <Link className="checkin-only-library" to="/biblioteca">
            Só vens à Biblioteca?
          </Link>
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
              esteve presente nos seus encontros. Só te enviamos a newsletter se marcares a caixa. Os
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
