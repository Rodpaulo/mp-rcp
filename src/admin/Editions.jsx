import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SAVE_ERROR, formatDate, yesNo } from './text.js'

// Forma curta do evento no pretix (SPEC 18.2): a mesma regra que a base confirma (migração 015).
const PRETIX_EVENT = /^[a-z0-9][a-z0-9.-]*$/
const PRETIX_INVALIDO = 'A forma curta só pode ter minúsculas, algarismos, hífenes e pontos.'

export default function Editions({ editions, open, onChange }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(false)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  // Preenchido com o código em minúsculas até a pessoa o mudar à mão.
  const [pretix, setPretix] = useState('')
  const [pretixTouched, setPretixTouched] = useState(false)
  const [message, setMessage] = useState('')

  async function run(action, label) {
    setSending(true)
    setError(false)
    setMessage('')
    try {
      await action()
      await onChange()
      return true
    } catch (err) {
      console.error(`${label} falhou:`, err)
      setError(true)
      return false
    } finally {
      setSending(false)
    }
  }

  function handleOpen(edition) {
    const question = open ? `Abrir ${edition.code} e fechar ${open.code}?` : `Abrir ${edition.code}?`
    if (!window.confirm(question)) return
    // Fechar primeiro: a base só admite uma edição aberta de cada vez.
    run(async () => {
      const closeRes = await supabase.from('editions').update({ is_open: false }).eq('is_open', true)
      if (closeRes.error) throw closeRes.error
      const openRes = await supabase.from('editions').update({ is_open: true }).eq('id', edition.id)
      if (openRes.error) throw openRes.error
    }, 'abrir edição')
  }

  function handleCodeChange(value) {
    setCode(value)
    if (!pretixTouched) setPretix(value.trim().toLowerCase())
  }

  function handleLinkPretix(edition) {
    const answer = window.prompt(
      'Forma curta do evento no pretix (a que aparece no endereço, ex.: rcp08):',
      edition.code.toLowerCase(),
    )
    if (answer === null) return
    const value = answer.trim().toLowerCase()
    if (!PRETIX_EVENT.test(value)) {
      setMessage(PRETIX_INVALIDO)
      return
    }
    run(async () => {
      const { error: updateError } = await supabase
        .from('editions')
        .update({ pretix_event: value })
        .eq('id', edition.id)
      if (updateError) throw updateError
    }, 'ligar ao pretix')
  }

  async function handleCreate(event) {
    event.preventDefault()
    const pretixEvent = pretix.trim().toLowerCase()
    if (pretixEvent && !PRETIX_EVENT.test(pretixEvent)) {
      setMessage(PRETIX_INVALIDO)
      return
    }
    const ok = await run(async () => {
      const { error: insertError } = await supabase.from('editions').insert({
        code: code.trim().toUpperCase(),
        title: title.trim() || null,
        event_date: date,
        pretix_event: pretixEvent || null,
      })
      if (insertError) throw insertError
    }, 'criar edição')
    if (ok) {
      setCode('')
      setTitle('')
      setDate('')
      setPretix('')
      setPretixTouched(false)
    }
  }

  return (
    <section className="admin-section">
      <h2>Edições</h2>
      {error && (
        <p className="admin-error" role="alert">
          {SAVE_ERROR}
        </p>
      )}
      {message && (
        <p className="admin-error" role="alert">
          {message}
        </p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Título</th>
              <th>Data</th>
              <th>Aberta</th>
              <th>Contagem de sala</th>
              <th>Pretix</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {editions.map((edition) => (
              <tr key={edition.id}>
                <td>{edition.code}</td>
                <td>{edition.title}</td>
                <td>{formatDate(edition.event_date)}</td>
                <td>{yesNo(edition.is_open)}</td>
                <td>{edition.room_count ?? ''}</td>
                <td>
                  {edition.pretix_event ?? (
                    <button
                      type="button"
                      className="admin-ligacao"
                      onClick={() => handleLinkPretix(edition)}
                      disabled={sending}
                    >
                      Ligar ao pretix
                    </button>
                  )}
                </td>
                <td>
                  {!edition.is_open && (
                    <button
                      type="button"
                      className="admin-button-secondary"
                      onClick={() => handleOpen(edition)}
                      disabled={sending}
                    >
                      Abrir esta edição
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Nova edição</h3>
      <form className="admin-new-edition" onSubmit={handleCreate}>
        <label className="admin-field">
          <span>Código</span>
          <input required placeholder="RCP07" value={code} onChange={(event) => handleCodeChange(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Título (opcional)</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Evento no pretix</span>
          <input
            placeholder="rcp08"
            value={pretix}
            autoCapitalize="off"
            spellCheck="false"
            onChange={(event) => {
              setPretix(event.target.value)
              setPretixTouched(true)
            }}
          />
        </label>
        <label className="admin-field">
          <span>Data</span>
          <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <button type="submit" className="admin-button" disabled={sending}>
          Criar edição
        </button>
      </form>
    </section>
  )
}
