import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SAVE_ERROR } from './text.js'

export default function Absent({ edition, absent, onChange }) {
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(false)

  async function markPresent(personId) {
    setSavingId(personId)
    setError(false)
    try {
      const { error: insertError } = await supabase
        .from('checkins')
        .insert({ person_id: personId, edition_id: edition.id, source: 'manual' })
      // 23505: a pessoa entretanto fez check-in; basta recarregar
      if (insertError && insertError.code !== '23505') throw insertError
      await onChange()
    } catch (err) {
      console.error('marcar presente falhou:', err)
      setError(true)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="admin-section">
      <h2>Inscritos ausentes ({absent.length})</h2>
      {error && (
        <p className="admin-error" role="alert">
          {SAVE_ERROR}
        </p>
      )}
      {absent.length === 0 ? (
        <p className="admin-muted">Não há inscritos ausentes.</p>
      ) : (
        <ul className="admin-list">
          {absent.map((a) => (
            <li key={a.personId}>
              <span>{a.email}</span>
              <button
                type="button"
                className="admin-button-secondary"
                onClick={() => markPresent(a.personId)}
                disabled={savingId !== null}
              >
                {savingId === a.personId ? 'Um momento…' : 'Marcar presente'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
