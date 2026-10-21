import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Checkins from './Checkins.jsx'
import Absent from './Absent.jsx'
import ImportRegistrations from './ImportRegistrations.jsx'
import RoomCount from './RoomCount.jsx'
import Editions from './Editions.jsx'
import { LOAD_ERROR, formatDate, formatTime } from './text.js'

const REFRESH_MS = 15000

async function fetchAll() {
  const [editionsRes, summaryRes] = await Promise.all([
    supabase
      .from('editions')
      .select('id, code, title, event_date, is_open, room_count')
      .order('event_date', { ascending: false }),
    supabase
      .from('edition_summary')
      .select('code, registered, present, walk_ins')
      .eq('is_open', true)
      .maybeSingle(),
  ])
  if (editionsRes.error) throw editionsRes.error
  if (summaryRes.error) throw summaryRes.error

  const open = editionsRes.data.find((edition) => edition.is_open) ?? null
  let checkins = []
  let registrations = []
  if (open) {
    const [checkinsRes, registrationsRes] = await Promise.all([
      supabase
        .from('checkins')
        .select('person_id, source, checked_in_at, people(email, newsletter_consent)')
        .eq('edition_id', open.id)
        .order('checked_in_at', { ascending: false }),
      supabase.from('registrations').select('person_id, people(email)').eq('edition_id', open.id),
    ])
    if (checkinsRes.error) throw checkinsRes.error
    if (registrationsRes.error) throw registrationsRes.error
    checkins = checkinsRes.data
    registrations = registrationsRes.data
  }

  return { editions: editionsRes.data, open, summary: summaryRes.data, checkins, registrations }
}

export default function Panel() {
  const [data, setData] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(
    () =>
      fetchAll().then(
        (fresh) => {
          setData(fresh)
          setUpdatedAt(new Date())
          setLoadError(false)
        },
        (error) => {
          console.error('carregar o painel falhou:', error)
          setLoadError(true)
        },
      ),
    [],
  )

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const refreshLine = (
    <div className="admin-refresh">
      <button type="button" className="admin-button-secondary" onClick={handleRefresh} disabled={refreshing}>
        Actualizar
      </button>
      {updatedAt && (
        <span>Última actualização: {updatedAt.toLocaleTimeString('pt-PT')}</span>
      )}
      {loadError && (
        <span className="admin-error" role="alert">
          {LOAD_ERROR}
        </span>
      )}
    </div>
  )

  if (!data) return refreshLine

  const { editions, open, summary, checkins, registrations } = data
  const registeredIds = new Set(registrations.map((r) => r.person_id))
  const presentIds = new Set(checkins.map((c) => c.person_id))

  const presences = checkins.map((c) => ({
    personId: c.person_id,
    email: c.people?.email ?? '',
    time: formatTime(c.checked_in_at),
    source: c.source,
    registered: registeredIds.has(c.person_id),
    newsletter: Boolean(c.people?.newsletter_consent),
  }))

  const absent = registrations
    .filter((r) => !presentIds.has(r.person_id))
    .map((r) => ({ personId: r.person_id, email: r.people?.email ?? '' }))
    .sort((a, b) => a.email.localeCompare(b.email))

  return (
    <>
      {open ? (
        <section className="admin-section">
          <h1 className="admin-edition">
            {[open.code, open.title, formatDate(open.event_date)].filter(Boolean).join(' · ')}
          </h1>
          <div className="admin-stats">
            <div>
              <strong>{summary?.registered ?? 0}</strong>
              <span>Inscritos</span>
            </div>
            <div>
              <strong>{summary?.present ?? 0}</strong>
              <span>Presentes</span>
            </div>
            <div>
              <strong>{summary?.walk_ins ?? 0}</strong>
              <span>dos quais walk-ins</span>
            </div>
          </div>
          {refreshLine}
        </section>
      ) : (
        <section className="admin-section">
          <h1 className="admin-edition">Não há nenhuma edição aberta neste momento.</h1>
          {refreshLine}
        </section>
      )}

      {open && (
        <>
          <Checkins edition={open} presences={presences} />
          <Absent edition={open} absent={absent} onChange={load} />
          <ImportRegistrations edition={open} onChange={load} />
          <RoomCount key={open.id} edition={open} onChange={load} />
        </>
      )}

      <Editions editions={editions} open={open} onChange={load} />
    </>
  )
}
