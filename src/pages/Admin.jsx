import { Suspense, lazy, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Login from '../admin/Login.jsx'
import Panel from '../admin/Panel.jsx'
import BarraNumeros from '../admin/mesa/BarraNumeros.jsx'
import Cabecalho from '../admin/mesa/Cabecalho.jsx'
import { SEPARADORES } from '../admin/mesa/separadores.js'
import { lerNomeDaSessao, lerNumerosRcp } from '../admin/numeros.js'
import { lerNumerosRede } from '../rede/numeros.js'
import { lerNumerosAssociados } from '../associados/numeros.js'
import { lerNumerosBiblioteca } from '../biblioteca-admin/numeros.js'
import '../admin/Admin.css'
import '../admin/mesa.css'

// Este ficheiro já vem à parte da página pública (App.jsx, SPEC 17.6); cada módulo vem à parte dele.
const Rede = lazy(() => import('../rede/Rede.jsx'))
const Biblioteca = lazy(() => import('../biblioteca-admin/Biblioteca.jsx'))
const Associados = lazy(() => import('../associados/Associados.jsx'))

const NUMEROS = {
  rcp: lerNumerosRcp,
  rede: lerNumerosRede,
  associados: lerNumerosAssociados,
  biblioteca: lerNumerosBiblioteca,
}

// Separador pelo endereço. ?b=… (os endereços da Biblioteca, SPEC 15.3) abre a Biblioteca.
function separadorDe(searchParams) {
  const s = searchParams.get('s')
  if (SEPARADORES.some((item) => item.valor === s)) return s
  if (searchParams.has('b')) return 'biblioteca'
  return 'rcp'
}

// A barra lê de novo ao abrir ou fechar um item (SPEC 17.3); pesquisas e filtros não contam.
function chaveDosNumeros(separador, searchParams) {
  const params = ['c', 'p', 'a', 'b', 'm', ...(separador === 'associados' ? ['e'] : [])]
  return [separador, ...params.map((p) => searchParams.get(p) ?? '')].join('|')
}

export default function Admin() {
  // undefined: ainda a ler a sessão; null: sem sessão
  const [session, setSession] = useState(undefined)
  const [nome, setNome] = useState('')
  const [searchParams] = useSearchParams()
  const separador = separadorDe(searchParams)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => data.subscription.unsubscribe()
  }, [])

  // Só quando muda a conta, não a cada renovação do token.
  const utilizador = session?.user.id
  const emailDaSessao = session?.user.email
  useEffect(() => {
    if (!utilizador) return
    lerNomeDaSessao(utilizador, emailDaSessao).then(setNome, (error) => {
      console.error('carregar nome falhou:', error)
      setNome(emailDaSessao)
    })
  }, [utilizador, emailDaSessao])

  if (session === undefined) return null

  if (!session) {
    return (
      <div className="mesa-app">
        <Cabecalho />
        <main className="admin">
          <Login />
        </main>
      </div>
    )
  }

  return (
    <div className="mesa-app">
      <Cabecalho separador={separador} nome={nome} onSair={() => supabase.auth.signOut()} />
      <BarraNumeros
        key={separador}
        ler={NUMEROS[separador]}
        chave={chaveDosNumeros(separador, searchParams)}
        intervalo={separador === 'rcp' ? 15000 : null}
      />
      {/* O separador que não está à vista desmonta: a leitura a cada 15 s do painel só corre no RCP. */}
      <main className="admin">
        {separador === 'rcp' ? (
          <Panel />
        ) : (
          <Suspense fallback={<p>A carregar…</p>}>
            {separador === 'rede' && <Rede />}
            {separador === 'associados' && <Associados />}
            {separador === 'biblioteca' && <Biblioteca />}
          </Suspense>
        )}
      </main>
    </div>
  )
}
