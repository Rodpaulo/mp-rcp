import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SAVE_ERROR } from './text.js'

// Estado local inicializado uma vez por edição (key no Panel), para o refresh não apagar o que se escreve.
export default function RoomCount({ edition, onChange }) {
  const [value, setValue] = useState(edition.room_count ?? '')
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSending(true)
    setSaved(false)
    setError(false)
    try {
      const roomCount = value === '' ? null : Number(value)
      const { error: updateError } = await supabase
        .from('editions')
        .update({ room_count: roomCount })
        .eq('id', edition.id)
      if (updateError) throw updateError
      setSaved(true)
      await onChange()
    } catch (err) {
      console.error('guardar contagem de sala falhou:', err)
      setError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="admin-section">
      <h2>Contagem de sala</h2>
      <form className="admin-inline" onSubmit={handleSubmit}>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          className="admin-number"
          aria-label="Contagem de sala"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setSaved(false)
          }}
        />
        <button type="submit" className="admin-button" disabled={sending}>
          {sending ? 'Um momento…' : 'Guardar'}
        </button>
        {saved && <span className="admin-ok">Guardado.</span>}
      </form>
      {error && (
        <p className="admin-error" role="alert">
          {SAVE_ERROR}
        </p>
      )}
    </section>
  )
}
