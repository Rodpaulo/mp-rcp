import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Login from '../admin/Login.jsx'
import Panel from '../admin/Panel.jsx'
import '../admin/Admin.css'

// O Rede só se descarrega quando se abre o separador: não pesa na página pública.
const Rede = lazy(() => import('../rede/Rede.jsx'))
// A Biblioteca do admin (SPEC 15) também vem à parte, só quando se abre o admin.
const Biblioteca = lazy(() => import('../biblioteca-admin/Biblioteca.jsx'))
// Os Associados (SPEC 16) também: só quando se abre o separador.
const Associados = lazy(() => import('../associados/Associados.jsx'))

const SEPARADORES = ['rede', 'associados']

export default function Admin() {
  // undefined: ainda a ler a sessão; null: sem sessão
  const [session, setSession] = useState(undefined)
  const [searchParams] = useSearchParams()
  const tab = SEPARADORES.includes(searchParams.get('s')) ? searchParams.get('s') : 'rcp'
  // ?b=… abre um livro ou o formulário da Biblioteca no lugar do painel do RCP.
  const livroAberto = searchParams.has('b')

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
      {session ? (
        <>
          <nav className="admin-tabs" aria-label="Secções">
            <Link to="/admin" className="admin-tab" aria-current={tab === 'rcp' ? 'page' : undefined}>
              RCP
            </Link>
            <Link to="/admin?s=rede" className="admin-tab" aria-current={tab === 'rede' ? 'page' : undefined}>
              Rede
            </Link>
            <Link to="/admin?s=associados" className="admin-tab" aria-current={tab === 'associados' ? 'page' : undefined}>
              Associados
            </Link>
          </nav>
          {/* O separador que não está à vista desmonta: a leitura a cada 15 s do painel pára no Rede
              e quando um livro da Biblioteca está aberto. */}
          {tab === 'rede' ? (
            <Suspense fallback={<p>A carregar…</p>}>
              <Rede />
            </Suspense>
          ) : tab === 'associados' ? (
            <Suspense fallback={<p>A carregar…</p>}>
              <Associados />
            </Suspense>
          ) : (
            <>
              {!livroAberto && <Panel />}
              <Suspense fallback={<p>A carregar…</p>}>
                <Biblioteca />
              </Suspense>
            </>
          )}
        </>
      ) : (
        <Login />
      )}
    </main>
  )
}
