import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Login from '../admin/Login.jsx'
import Panel from '../admin/Panel.jsx'
import '../admin/Admin.css'

export default function Admin() {
  // undefined: ainda a ler a sessão; null: sem sessão
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <main className="admin">
      <header className="admin-bar">
        <img className="admin-logo" src="/logo-mp.png" alt="Matinés Pensantes" />
        {session && (
          <button type="button" className="admin-button-secondary" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        )}
      </header>
      {session ? <Panel /> : <Login />}
    </main>
  )
}
