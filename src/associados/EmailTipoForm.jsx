import { useEffect, useMemo, useRef, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import {
  camposAssociado,
  camposContacto,
  camposDoTexto,
  camposPedido,
  dataBruxelas,
  preencher,
} from '../../supabase/functions/_shared/campos.js'
import {
  gravarEmailTipo,
  lerConfiguracao,
  listarAssociados,
  listarContactosSemPedido,
  listarPedidos,
  obterEmailTipo,
} from './api.js'
import EscolhaRegisto from './EscolhaRegisto.jsx'
import {
  CAMPOS,
  ESTADOS_PEDIDO,
  FONTES,
  MANUAIS,
  fonteDoEmail,
  nomeDoAssociado,
  normalizar,
  numeroEmail,
  rotulo,
} from './textos.js'

const NOMES_CONHECIDOS = new Set(CAMPOS.map((c) => c.nome))
const vazioTexto = (v) => v === null || v === undefined || String(v).trim() === ''

const porNome = (a, b) => a.rotulo.localeCompare(b.rotulo, 'pt')

// Registos para a lista de escolha: contactos por nome (rótulo: nome; detalhe: email),
// pedidos por nome (nome e estado), associados por número (número e nome).
async function carregarFonte(fonte) {
  if (fonte === 'contacto') {
    return (await listarContactosSemPedido())
      .map((c) => ({ id: c.id, rotulo: c.nome, detalhe: c.email, procura: normalizar(`${c.nome} ${c.email ?? ''}`), dados: c }))
      .sort(porNome)
  }
  if (fonte === 'pedido') {
    return (await listarPedidos())
      .map((p) => ({
        id: p.id,
        rotulo: p.nome_completo,
        detalhe: rotulo(ESTADOS_PEDIDO, p.estado),
        procura: normalizar(`${p.nome_completo} ${p.email}`),
        dados: p,
      }))
      .sort(porNome)
  }
  return (await listarAssociados()).map((a) => ({
    id: a.id,
    rotulo: `n.º ${a.numero} · ${nomeDoAssociado(a)}`,
    procura: normalizar(`${a.numero} ${nomeDoAssociado(a)}`),
    dados: a,
  }))
}

const VAZIO = {
  contacto: 'Não há contactos do Rede com a etiqueta associado e sem pedido de adesão.',
  pedido: 'Ainda não há pedidos de adesão.',
  associado: 'Ainda não há associados.',
}

// Campos do registo escolhido, com as mesmas funções que as Edge Functions usam.
// Num associado, a quota mais recente dá {ano}, {valor_quota} e {numero_recibo}.
function camposDaFonte(fonte, registo, config, hoje) {
  if (!registo) return {}
  if (fonte === 'contacto') return camposContacto(registo, config, hoje)
  if (fonte === 'pedido') return camposPedido(registo, config, hoje)
  const quota = [...registo.quotas].sort((a, b) => b.ano - a.ano)[0] ?? null
  return camposAssociado(registo, config, hoje, quota)
}

export default function EmailTipoForm({ chave, onVoltar }) {
  const hoje = dataBruxelas()
  const fonte = fonteDoEmail(chave)
  const manual = MANUAIS.includes(chave)
  const corpoRef = useRef(null)

  const [tipo, setTipo] = useState(undefined)
  const [config, setConfig] = useState(null)
  const [registos, setRegistos] = useState(null)
  const [erro, setErro] = useState(false)
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [registoId, setRegistoId] = useState('')
  const [manuais, setManuais] = useState({}) // valores mudados à mão, só para a pré-visualização
  const [aGravar, setAGravar] = useState(false)
  const [estadoGravar, setEstadoGravar] = useState('') // '' | 'gravado' | 'erro'
  const [copia, setCopia] = useState('')

  useEffect(() => {
    let activo = true
    Promise.all([obterEmailTipo(chave), lerConfiguracao(), carregarFonte(fonte)]).then(
      ([t, c, r]) => {
        if (!activo) return
        setTipo(t)
        setConfig(c)
        setRegistos(r)
        if (t) {
          setAssunto(t.assunto)
          setCorpo(t.corpo)
        }
        if (r.length) setRegistoId(r[0].id)
      },
      (error) => {
        console.error('carregar email-tipo falhou:', error)
        if (activo) setErro(true)
      },
    )
    return () => {
      activo = false
    }
  }, [chave, fonte])

  const registo = registos?.find((r) => r.id === registoId)?.dados
  const base = useMemo(() => (config ? camposDaFonte(fonte, registo, config, hoje) : {}), [fonte, registo, config, hoje])
  const usados = camposDoTexto(assunto, corpo)
  const valores = { ...manuais, ...Object.fromEntries(Object.entries(base).filter(([, v]) => !vazioTexto(v))) }
  const prev = { assunto: preencher(assunto, valores, hoje), corpo: preencher(corpo, valores, hoje) }
  const emFalta = [...new Set([...prev.assunto.emFalta, ...prev.corpo.emFalta])]
  const desconhecidos = usados.filter((n) => !NOMES_CONHECIDOS.has(n))
  const alterado = tipo && (assunto !== tipo.assunto || corpo !== tipo.corpo)

  function inserirCampo(nome) {
    const el = corpoRef.current
    const marca = `{${nome}}`
    const ini = el?.selectionStart ?? corpo.length
    const fim = el?.selectionEnd ?? corpo.length
    setCorpo(corpo.slice(0, ini) + marca + corpo.slice(fim))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(ini + marca.length, ini + marca.length)
    })
  }

  async function gravar(event) {
    event.preventDefault()
    setAGravar(true)
    setEstadoGravar('')
    try {
      await gravarEmailTipo(chave, { assunto, corpo })
      setTipo((t) => ({ ...t, assunto, corpo }))
      setEstadoGravar('gravado')
    } catch (error) {
      console.error('gravar email-tipo falhou:', error)
      setEstadoGravar('erro')
    } finally {
      setAGravar(false)
    }
  }

  async function copiar(texto, o) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopia(`${o} copiado.`)
    } catch (error) {
      console.error('copiar falhou:', error)
      setCopia('Não foi possível copiar. Selecciona o texto da pré-visualização e copia à mão.')
    }
  }

  const voltar = (
    <button type="button" className="admin-button-secondary" onClick={onVoltar}>
      Voltar à lista
    </button>
  )

  if (erro || tipo === null) {
    return (
      <section className="admin-section">
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este email-tipo não existe.'}
        </p>
        {voltar}
      </section>
    )
  }
  if (tipo === undefined) return <p>A carregar…</p>

  return (
    <>
      <form className="admin-section assoc-form-largo" onSubmit={gravar}>
        <div className="admin-section-head">
          <h2>
            {numeroEmail(chave)}. {tipo.nome}
          </h2>
          {voltar}
        </div>
        {tipo.quando && <p className="assoc-nota">Quando: {tipo.quando}</p>}

        <label className="admin-field">
          <span>Assunto</span>
          <input value={assunto} required onChange={(event) => setAssunto(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Corpo</span>
          <textarea
            ref={corpoRef}
            className="assoc-texto-campo assoc-corpo"
            rows={18}
            required
            value={corpo}
            onChange={(event) => setCorpo(event.target.value)}
          />
        </label>

        {desconhecidos.length > 0 && (
          <p className="admin-error" role="alert">
            Campos desconhecidos no texto: {desconhecidos.map((n) => `{${n}}`).join(', ')}. Confirma o nome na lista.
          </p>
        )}

        <details className="assoc-campos">
          <summary>Campos disponíveis (carrega para inserir no corpo)</summary>
          <ul>
            {CAMPOS.map((c) => (
              <li key={c.nome}>
                <button type="button" className="assoc-campo" onClick={() => inserirCampo(c.nome)}>
                  {`{${c.nome}}`}
                </button>{' '}
                {c.descricao} <span className="assoc-linha-detalhe">· {c.origem}</span>
              </li>
            ))}
          </ul>
          <p className="assoc-nota">
            Uma linha que comece por <code>[Só até 31/12/2026] </code> só entra no email até essa data.
          </p>
        </details>

        {estadoGravar === 'gravado' && !alterado && (
          <p className="assoc-aviso" role="status">
            Gravado.
          </p>
        )}
        {estadoGravar === 'erro' && (
          <p className="admin-error" role="alert">
            {SAVE_ERROR}
          </p>
        )}
        <div className="assoc-accoes">
          <button type="submit" className="admin-button" disabled={aGravar || !alterado}>
            {aGravar ? 'Um momento…' : 'Gravar'}
          </button>
          {alterado && (
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => {
                setAssunto(tipo.assunto)
                setCorpo(tipo.corpo)
              }}
            >
              Desfazer alterações
            </button>
          )}
        </div>
      </form>

      <section className="admin-section">
        <h2>Pré-visualização</h2>
        <p className="assoc-nota">Com o texto acima, mesmo antes de gravar. Copiar não regista envio.</p>

        <EscolhaRegisto
          titulo={FONTES[fonte]}
          vazio={VAZIO[fonte]}
          registos={registos}
          escolhido={registoId}
          onEscolher={(id) => {
            setRegistoId(id)
            setManuais({})
          }}
        />

        {usados.length > 0 && (
          <fieldset className="assoc-valores">
            <legend>Campos deste email</legend>
            <p className="assoc-nota">
              Os que vêm do registo escolhido ou da configuração não se escrevem aqui; só os que faltam.
            </p>
            {usados.map((nome) => {
              // Vem dos dados (registo ou configuração): só leitura. Sem valor: caixa para preencher.
              const doRegisto = !vazioTexto(base[nome])
              const valor = doRegisto ? String(base[nome]) : (manuais[nome] ?? '')
              const falta = emFalta.includes(nome)
              return (
                <label key={nome} className={`admin-field ${falta ? 'assoc-campo-falta' : ''}`}>
                  <span>
                    {`{${nome}}`}
                    {falta && ' · por preencher'}
                  </span>
                  <input
                    value={valor}
                    readOnly={doRegisto}
                    className={doRegisto ? 'assoc-campo-lido' : undefined}
                    onChange={(event) => setManuais((m) => ({ ...m, [nome]: event.target.value }))}
                  />
                </label>
              )
            })}
          </fieldset>
        )}

        {emFalta.length > 0 && (
          <p className="assoc-aviso" role="status">
            Por preencher: {emFalta.map((n) => `{${n}}`).join(', ')}.
            {manual ? ' Preenche-os acima para poder copiar.' : ' Um email automático com campos por preencher não sai.'}
          </p>
        )}

        <div className="assoc-previsualizacao">
          <p className="assoc-previsualizacao-assunto">{prev.assunto.texto}</p>
          <p className="assoc-texto">{prev.corpo.texto}</p>
        </div>

        {manual && (
          <div className="assoc-accoes">
            <button
              type="button"
              className="admin-button-secondary"
              disabled={emFalta.length > 0}
              onClick={() => copiar(prev.assunto.texto, 'Assunto')}
            >
              Copiar assunto
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={emFalta.length > 0}
              onClick={() => copiar(prev.corpo.texto, 'Texto')}
            >
              Copiar texto preenchido
            </button>
          </div>
        )}
        {copia && (
          <p className="assoc-aviso" role="status">
            {copia}
          </p>
        )}
      </section>
    </>
  )
}
