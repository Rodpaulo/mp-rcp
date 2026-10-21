import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { LOAD_ERROR } from './text.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSending(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) {
        console.error('login falhou:', error)
        // 400 = credenciais erradas; o resto é rede ou servidor
        setMessage(error.status === 400 ? 'Email ou senha errados.' : LOAD_ERROR)
      }
    } catch (error) {
      console.error('login falhou:', error)
      setMessage(LOAD_ERROR)
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="admin-login" onSubmit={handleSubmit}>
      <h1>Entrar</h1>
      <label className="admin-field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="username"
          autoCapitalize="off"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="admin-field">
        <span>Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {message && (
        <p className="admin-error" role="alert">
          {message}
        </p>
      )}
      <button type="submit" className="admin-button" disabled={sending}>
        {sending ? 'Um momento…' : 'Entrar'}
      </button>
    </form>
  )
}
