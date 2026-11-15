import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { extractEmails } from './csv.js'
import { LOAD_ERROR, SAVE_ERROR } from './text.js'

// Importar inscritos (SPEC 8 e 18.7): primeiro o pretix, pela função pretix-inscritos; por baixo,
// como alternativa, o CSV exportado do pretix. Os dois caminhos gravam pela importar_inscritos
// (migração 016), com a origem 'pretix'.

// A função devolve { erro } com o texto para mostrar tal como está (SPEC 18.7).
async function mensagemDoErro(error) {
  try {
    const corpo = await error.context.json()
    if (corpo?.erro) return corpo.erro
  } catch {
    // sem corpo JSON (sem rede, por exemplo): fica o erro genérico
  }
  return SAVE_ERROR
}

function linhasDoResultado(r) {
  const linhas = [
    `${r.novos} inscrições novas; ${r.ja_estavam} já lá estavam; ${r.cancelados} canceladas no pretix, não entraram.`,
  ]
  if (r.marcados > 0) linhas.push(`${r.marcados} já estavam na lista e ficaram marcadas como canceladas.`)
  if (r.invalidos > 0) linhas.push(`${r.invalidos} ignoradas por não terem um email válido.`)
  return linhas
}

function DoPretix({ edition, onChange }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleUpdate() {
    setSending(true)
    setResult(null)
    setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('pretix-inscritos', { body: {} })
      if (invokeError) {
        setError(await mensagemDoErro(invokeError))
        return
      }
      setResult(linhasDoResultado(data))
      await onChange()
    } catch (err) {
      console.error('pretix-inscritos falhou:', err?.name ?? 'erro')
      setError(SAVE_ERROR)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <p className="admin-muted">
        Lê no pretix as inscrições confirmadas e junta-as aos inscritos. Podes carregar as vezes que quiseres:
        ninguém fica repetido.
      </p>
      {edition.pretix_event ? (
        <button type="button" className="mesa-botao" onClick={handleUpdate} disabled={sending}>
          {sending ? 'Um momento…' : 'Actualizar do pretix'}
        </button>
      ) : (
        <>
          <button type="button" className="mesa-botao" disabled>
            Actualizar do pretix
          </button>
          <p className="admin-muted">
            Esta edição não está ligada a um evento do pretix. Liga-a em Edições, mais abaixo.
          </p>
        </>
      )}
      {result && (
        <div className="admin-ok" role="status">
          {result.map((linha) => (
            <p key={linha}>{linha}</p>
          ))}
        </div>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

function DoFicheiro({ edition, onChange }) {
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
      console.error('ler o ficheiro falhou:', err?.name ?? 'erro')
      setError(LOAD_ERROR)
    }
  }

  async function handleImport() {
    if (!parsed?.emails.length) return
    setSending(true)
    setResult('')
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('importar_inscritos', {
        p_edition_code: edition.code,
        p_inscritos: parsed.emails.map((email) => ({ email })),
        p_cancelados: [],
      })
      if (rpcError) throw rpcError
      setResult(`${data?.novos ?? 0} inscrições novas; ${data?.ja_estavam ?? 0} já lá estavam`)
      await onChange()
    } catch (err) {
      console.error('importar_inscritos falhou:', err?.code ?? err?.name ?? 'erro')
      setError(SAVE_ERROR)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-separador">
      <p className="admin-muted">Ou cola aqui o CSV exportado do pretix, ou escolhe o ficheiro.</p>
      <p className="admin-muted">No pretix: Encomendas → Exportar, só as pagas.</p>
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
            className="mesa-botao-secundario"
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
    </div>
  )
}

export default function ImportRegistrations({ edition, onChange }) {
  return (
    <section className="admin-section">
      <h2>Importar inscritos</h2>
      <DoPretix edition={edition} onChange={onChange} />
      <DoFicheiro edition={edition} onChange={onChange} />
    </section>
  )
}
