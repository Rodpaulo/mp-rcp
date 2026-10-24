import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { KEY_EMAIL, readKey, writeKey } from '../lib/storage.js'
import './Biblioteca.css'

const TEXT = {
  empty: 'A mesa ainda está vazia. Sê a primeira pessoa a deixar um livro.',
  taken: 'Boa leitura. Quando o acabares, traz outro.',
  alreadyTaken: 'Esse livro já foi registado como levado. Se o tens na mão, diz à organização.',
  notFound: 'Não encontramos esse número. Confirma o autocolante na contracapa.',
  invalidNumber: 'Esse número não parece certo. Escreve só os algarismos do autocolante.',
  invalidEmail: 'Esse email não parece completo. Vê se não falta nada.',
  closed: 'Não há nenhuma edição aberta neste momento.',
  inUse: 'Esse número já está em uso. Usa o próximo autocolante da folha.',
  missingTitle: 'Falta o título.',
  // A mesma frase da página de check-in.
  error: 'Não conseguimos registar agora. Tenta outra vez daqui a um minuto, ou diz à organização.',
}

const LOOKUP_DELAY_MS = 600

function titleWithAuthor(book) {
  return book.author ? `«${book.title}», de ${book.author}` : `«${book.title}»`
}

// Guarda o email só se ainda não havia nenhum neste browser.
function rememberEmail(email) {
  if (email && !readKey(KEY_EMAIL)) writeKey(KEY_EMAIL, email)
}

// Consulta um livro pelo número do autocolante: ao fim de 600 ms sem escrever, ou ao sair do campo.
// O resultado só vale para o número que está no campo; enquanto não chega, fica 'idle'.
function useBookLookup(number) {
  const [lookup, setLookup] = useState({ query: '', state: 'idle', book: null })
  const latest = useRef('')

  const check = useCallback((raw) => {
    const query = raw.trim()
    if (query === latest.current) return
    latest.current = query
    if (!query) return

    supabase
      .rpc('livro_por_numero', { p_number: query })
      .then(({ data, error }) => {
        if (error) throw error
        if (latest.current !== query) return
        setLookup({ query, state: data ? 'found' : 'missing', book: data })
      })
      .catch((error) => {
        // Sem a consulta, a página segue: a resposta da função de registo decide.
        console.error('livro_por_numero falhou:', error)
      })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => check(number), LOOKUP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [number, check])

  const current = lookup.query === number.trim() ? lookup : { state: 'idle', book: null }
  return [current, () => check(number)]
}

function NumberField({ id, value, onChange, onBlur, disabled }) {
  return (
    <>
      <label className="bc-label" htmlFor={id}>
        Número do autocolante
      </label>
      <input
        id={id}
        className="bc-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck="false"
        placeholder="12 ou BC-012"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
      />
    </>
  )
}

function EmailField({ id, label, value, onChange, disabled }) {
  return (
    <>
      <label className="bc-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="bc-input"
        type="email"
        autoComplete="email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        inputMode="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </>
  )
}

function TakeForm({ onDone, onBack }) {
  const [number, setNumber] = useState('')
  const [email, setEmail] = useState(() => readKey(KEY_EMAIL) ?? '')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [lookup, checkNow] = useBookLookup(number)

  async function handleSubmit(event) {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    setSending(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('levar_livro', {
        p_number: number.trim(),
        p_email: normalized,
      })
      if (error) throw error

      switch (data?.status) {
        case 'ok':
          rememberEmail(normalized)
          onDone(TEXT.taken)
          return
        case 'already_taken':
          setMessage(TEXT.alreadyTaken)
          break
        case 'not_found':
          setMessage(TEXT.notFound)
          break
        case 'invalid_number':
          setMessage(TEXT.invalidNumber)
          break
        case 'invalid_email':
          setMessage(TEXT.invalidEmail)
          break
        case 'no_open_edition':
          setMessage(TEXT.closed)
          break
        default:
          throw new Error(`resposta inesperada de levar_livro: ${JSON.stringify(data)}`)
      }
    } catch (error) {
      console.error('levar_livro falhou:', error)
      setMessage(TEXT.error)
    }
    setSending(false)
  }

  return (
    <form className="bc-form" onSubmit={handleSubmit} noValidate>
      <h2 className="bc-subtitle">Levo um livro</h2>

      <NumberField id="bc-take-number" value={number} onChange={setNumber} onBlur={checkNow} disabled={sending} />
      {lookup.state === 'found' && <p className="bc-hint">{titleWithAuthor(lookup.book)}</p>}
      {lookup.state === 'missing' && <p className="bc-hint">{TEXT.notFound}</p>}

      <EmailField id="bc-take-email" label="O teu email" value={email} onChange={setEmail} disabled={sending} />

      {message && (
        <p className="bc-message" role="alert">
          {message}
        </p>
      )}

      <button
        type="submit"
        className="bc-button bc-confirm"
        disabled={sending || !number.trim() || !email.trim()}
      >
        {sending ? 'Um momento…' : 'Levo este'}
      </button>
      <button type="button" className="bc-link bc-back" onClick={onBack}>
        Voltar
      </button>
    </form>
  )
}

function LeaveForm({ onDone, onBack }) {
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState(() => readKey(KEY_EMAIL) ?? '')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [lookup, checkNow] = useBookLookup(number)

  const found = lookup.state === 'found'
  const inUse = found && lookup.book.status === 'na_mesa'
  // Um número que já existe e não está na mesa é um livro que volta: mantém o título.
  const isReturn = found && !inUse

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isReturn && !title.trim()) {
      setMessage(TEXT.missingTitle)
      return
    }

    const normalized = email.trim().toLowerCase()
    setSending(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('deixar_livro', {
        p_number: number.trim(),
        p_title: isReturn ? null : title.trim(),
        p_author: isReturn ? null : author.trim() || null,
        p_note: isReturn ? null : note.trim() || null,
        p_email: normalized || null,
      })
      if (error) throw error

      switch (data?.status) {
        case 'ok':
          rememberEmail(normalized)
          onDone(`Obrigado. O «${data.title}» já faz parte da Biblioteca.`)
          return
        case 'returned':
          rememberEmail(normalized)
          onDone(`Bem-vindo de volta, «${data.title}».`)
          return
        case 'number_in_use':
          setMessage(TEXT.inUse)
          break
        case 'missing_title':
          setMessage(TEXT.missingTitle)
          break
        case 'invalid_number':
          setMessage(TEXT.invalidNumber)
          break
        case 'invalid_email':
          setMessage(TEXT.invalidEmail)
          break
        case 'no_open_edition':
          setMessage(TEXT.closed)
          break
        default:
          throw new Error(`resposta inesperada de deixar_livro: ${JSON.stringify(data)}`)
      }
    } catch (error) {
      console.error('deixar_livro falhou:', error)
      setMessage(TEXT.error)
    }
    setSending(false)
  }

  return (
    <form className="bc-form" onSubmit={handleSubmit} noValidate>
      <h2 className="bc-subtitle">Deixo um livro</h2>
      <p className="bc-instruction">
        Cola o próximo autocolante da folha na contracapa do livro, no canto de baixo, sem tapar o código de
        barras, e escreve aqui o número.
      </p>

      <NumberField id="bc-leave-number" value={number} onChange={setNumber} onBlur={checkNow} disabled={sending} />
      {isReturn && (
        <p className="bc-hint">Este número é «{lookup.book.title}». Se o livro voltou à mesa, confirma.</p>
      )}
      {inUse && <p className="bc-hint">{TEXT.inUse}</p>}

      {!isReturn && (
        <>
          <label className="bc-label" htmlFor="bc-leave-title">
            Título
          </label>
          <input
            id="bc-leave-title"
            className="bc-input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={sending}
          />

          <label className="bc-label" htmlFor="bc-leave-author">
            Autor (opcional)
          </label>
          <input
            id="bc-leave-author"
            className="bc-input"
            type="text"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            disabled={sending}
          />

          <label className="bc-label" htmlFor="bc-leave-note">
            Porque o trazes? (uma linha, opcional)
          </label>
          <input
            id="bc-leave-note"
            className="bc-input"
            type="text"
            maxLength={140}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={sending}
          />
        </>
      )}

      <EmailField
        id="bc-leave-email"
        label="O teu email (opcional)"
        value={email}
        onChange={setEmail}
        disabled={sending}
      />

      {message && (
        <p className="bc-message" role="alert">
          {message}
        </p>
      )}

      <button type="submit" className="bc-button bc-confirm" disabled={sending || !number.trim() || inUse}>
        {sending ? 'Um momento…' : 'Deixo este'}
      </button>
      <button type="button" className="bc-link bc-back" onClick={onBack}>
        Voltar
      </button>
    </form>
  )
}

function BookList({ books }) {
  if (books.length === 0) {
    return <p className="bc-empty">{TEXT.empty}</p>
  }

  return (
    <ul className="bc-books">
      {books.map((book) => (
        <li key={book.number} className="bc-book">
          <span className="bc-number">{book.number}</span>
          <div className="bc-book-text">
            <p className="bc-book-title">{book.title}</p>
            {book.author && <p className="bc-book-author">{book.author}</p>}
            <p className="bc-book-meta">
              {book.since && `desde o ${book.since}`}
              {book.since && book.hands > 0 && ' · '}
              {book.hands > 0 && `já esteve em ${book.hands} ${book.hands === 1 ? 'casa' : 'casas'}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Biblioteca() {
  // view: 'list' | 'take' | 'leave' | 'done'
  const [view, setView] = useState('list')
  // null enquanto a lista não chega (ou se não chegou)
  const [books, setBooks] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const [showPrivacy, setShowPrivacy] = useState(false)

  useEffect(() => {
    if (view !== 'list') return
    let ignore = false

    supabase
      .rpc('biblioteca_na_mesa')
      .then(({ data, error }) => {
        if (error) throw error
        if (!ignore) setBooks(data ?? [])
      })
      .catch((error) => {
        console.error('biblioteca_na_mesa falhou:', error)
      })

    return () => {
      ignore = true
    }
  }, [view])

  function handleDone(text) {
    setConfirmation(text)
    setView('done')
  }

  function backToList() {
    setView('list')
  }

  return (
    <main className="bc">
      <header className="bc-header">
        <img className="bc-logo" src="/logo-mp.png" alt="Matinés Pensantes" />
        <h1 className="bc-title">Biblioteca Circulante</h1>
        <p className="bc-tagline">Traz um livro em português. Leva outro.</p>
      </header>

      {view === 'list' && (
        <section>
          <h2 className="bc-subtitle">Na mesa hoje</h2>
          {books && <BookList books={books} />}
          <div className="bc-actions">
            <button type="button" className="bc-button bc-choice" onClick={() => setView('take')}>
              Levo um livro
            </button>
            <button type="button" className="bc-button bc-choice" onClick={() => setView('leave')}>
              Deixo um livro
            </button>
          </div>
        </section>
      )}

      {view === 'take' && <TakeForm onDone={handleDone} onBack={backToList} />}
      {view === 'leave' && <LeaveForm onDone={handleDone} onBack={backToList} />}

      {view === 'done' && (
        <section>
          <p className="bc-confirmation" role="status">
            {confirmation}
          </p>
          <button type="button" className="bc-link bc-back" onClick={backToList}>
            Voltar à mesa
          </button>
        </section>
      )}

      <footer className="bc-footer">
        <button
          type="button"
          className="bc-link"
          aria-expanded={showPrivacy}
          aria-controls="bc-privacy"
          onClick={() => setShowPrivacy((open) => !open)}
        >
          Como tratamos os teus dados
        </button>
        {showPrivacy && (
          <p id="bc-privacy" className="bc-privacy">
            A Matinés Pensantes (geral@matinespensantes.org) regista o teu email para saber quem esteve
            presente nos seus encontros e os livros que deixas ou levas na Biblioteca Circulante. Só te
            enviamos a newsletter se marcares a caixa. Os dados ficam numa base de dados na União
            Europeia, enquanto a associação organizar o Regresso à Casa de Partida. Para consultar ou
            apagar os teus dados, escreve-nos para geral@matinespensantes.org.
          </p>
        )}
      </footer>
    </main>
  )
}
