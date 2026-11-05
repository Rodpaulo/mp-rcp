import { useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { criarConfiguracao, gravarConfiguracao, listarConfiguracao } from './api.js'

// Uma chave: o valor grava-se à parte, linha a linha.
function Linha({ linha, onGravado }) {
  const [valor, setValor] = useState(linha.valor ?? '')
  const [estado, setEstado] = useState('') // '' | 'a_gravar' | 'gravado' | 'erro'
  const alterado = valor.trim() !== (linha.valor ?? '')
  const longo = (linha.valor ?? '').length > 60 || linha.chave === 'consequencia_90_dias'

  async function gravar(event) {
    event.preventDefault()
    setEstado('a_gravar')
    try {
      await gravarConfiguracao(linha.chave, valor)
      setEstado('gravado')
      onGravado(linha.chave, valor.trim() || null)
    } catch (error) {
      console.error('gravar configuração falhou:', error)
      setEstado('erro')
    }
  }

  return (
    <form className="assoc-config-linha" onSubmit={gravar}>
      <label className="admin-field">
        <span>
          <code>{linha.chave}</code>
          {!linha.valor && <span className="assoc-config-vazio"> · vazio</span>}
        </span>
        {linha.descricao && <span className="assoc-linha-detalhe">{linha.descricao}</span>}
        {longo ? (
          <textarea className="assoc-texto-campo" rows={3} value={valor} onChange={(event) => setValor(event.target.value)} />
        ) : (
          <input value={valor} onChange={(event) => setValor(event.target.value)} />
        )}
      </label>
      <div className="assoc-accoes">
        <button type="submit" className="admin-button-secondary" disabled={!alterado || estado === 'a_gravar'}>
          {estado === 'a_gravar' ? 'Um momento…' : 'Gravar'}
        </button>
        {estado === 'gravado' && !alterado && <span role="status">Gravado.</span>}
        {estado === 'erro' && (
          <span className="admin-error" role="alert">
            {SAVE_ERROR}
          </span>
        )}
      </div>
    </form>
  )
}

function NovaChave({ existentes, onCriada }) {
  const [aberto, setAberto] = useState(false)
  const [f, setF] = useState({ chave: '', valor: '', descricao: '' })
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)

  if (!aberto) {
    return (
      <button type="button" className="admin-button-secondary" onClick={() => setAberto(true)}>
        Acrescentar chave
      </button>
    )
  }

  async function criar(event) {
    event.preventDefault()
    const chave = f.chave.trim()
    if (!/^[a-z0-9_]+$/.test(chave)) return setErro('A chave leva só minúsculas, algarismos e _ (por exemplo valor_quota_2028).')
    if (existentes.includes(chave)) return setErro('Essa chave já existe.')
    setAGravar(true)
    setErro('')
    try {
      await criarConfiguracao({ ...f, chave })
      onCriada()
    } catch (error) {
      console.error('criar chave falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
    }
  }

  const mudar = (campo) => (event) => setF((a) => ({ ...a, [campo]: event.target.value }))

  return (
    <form className="assoc-gesto" onSubmit={criar}>
      <h3>Acrescentar chave</h3>
      <label className="admin-field">
        <span>Chave</span>
        <input required autoCapitalize="off" placeholder="valor_quota_2028" value={f.chave} onChange={mudar('chave')} />
      </label>
      <label className="admin-field">
        <span>Valor</span>
        <input value={f.valor} onChange={mudar('valor')} />
      </label>
      <label className="admin-field">
        <span>Descrição</span>
        <input value={f.descricao} onChange={mudar('descricao')} />
      </label>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      <div className="assoc-accoes">
        <button type="submit" className="admin-button" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Acrescentar'}
        </button>
        <button type="button" className="admin-button-secondary" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function Configuracao() {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState(false)

  function carregar() {
    listarConfiguracao().then(setLinhas, (error) => {
      console.error('carregar configuração falhou:', error)
      setErro(true)
    })
  }

  useEffect(carregar, [])

  return (
    <section className="admin-section assoc-form-largo">
      <h2>Configuração</h2>
      <p className="assoc-nota">
        Valores usados nos emails. Um valor vazio impede os emails que o usam: ficam registados como falhados e a função
        diária tenta de novo no dia seguinte.
      </p>
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {linhas && (
        <>
          {linhas.map((linha) => (
            <Linha
              key={linha.chave}
              linha={linha}
              onGravado={(chave, valor) =>
                setLinhas((actuais) => actuais.map((l) => (l.chave === chave ? { ...l, valor } : l)))
              }
            />
          ))}
          <NovaChave key={linhas.length} existentes={linhas.map((l) => l.chave)} onCriada={carregar} />
        </>
      )}
    </section>
  )
}
