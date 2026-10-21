import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { extractEmails } from './csv.js'
import { LOAD_ERROR, SAVE_ERROR } from './text.js'

export default function ImportRegistrations({ edition, onChange }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const parsed = text.trim() ? extractEmails(text) : null

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setText(await file.text())
      setResult('')
      setError('')
    } catch (err) {
      console.error('ler o ficheiro falhou:', err)
      setError(LOAD_ERROR)
    }
  }

  async function handleImport() {
    if (!parsed?.emails.length) return
    setSending(true)
    setResult('')
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('import_registrations', {
        p_edition_code: edition.code,
        p_emails: parsed.emails,
      })
      if (rpcError) throw rpcError
      const created = data ?? 0
      setResult(`${created} inscrições novas; ${parsed.emails.length - created} já existiam`)
      await onChange()
    } catch (err) {
      console.error('import_registrations falhou:', err)
      setError(SAVE_ERROR)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="admin-section">
      <h2>Importar inscritos</h2>
      <p className="admin-muted">Cola aqui o CSV exportado do MailPoet, ou escolhe o ficheiro.</p>
      <textarea
        className="admin-textarea"
        rows={6}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setResult('')
        }}
        spellCheck="false"
      />
      <input type="file" accept=".csv,text/csv" onChange={handleFile} className="admin-file" />

      {parsed && !parsed.column && (
        <p className="admin-error">Não encontrei nenhuma coluna de email na primeira linha.</p>
      )}
      {parsed?.column && (
        <>
          <p>
            <strong>{parsed.emails.length} emails encontrados</strong>
          </p>
          {parsed.ignored.length > 0 && (
            <details className="admin-ignored">
              <summary>{parsed.ignored.length} ignorados por não parecerem emails</summary>
              <ul>
                {parsed.ignored.map((value, i) => (
                  <li key={i}>{value}</li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            className="admin-button"
            onClick={handleImport}
            disabled={sending || parsed.emails.length === 0}
          >
            {sending ? 'Um momento…' : 'Importar'}
          </button>
        </>
      )}
      {result && (
        <p className="admin-ok" role="status">
          {result}
        </p>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
