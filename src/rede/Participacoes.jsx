import { useCallback, useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR, formatDate } from '../admin/text.js'
import { apagarParticipacao, criarParticipacao, listarEdicoes, listarParticipacoes } from './api.js'
import { PAPEIS, rotulo } from './listas.js'

function nomeEdicao(edicao) {
  return [edicao.code, edicao.title].filter(Boolean).join(' · ')
}

// Participações de um contacto nas edições do RCP. Lê editions; escreve só em participacoes.
export default function Participacoes({ contactoId }) {
  const [participacoes, setParticipacoes] = useState(null)
  const [edicoes, setEdicoes] = useState([])
  const [edicaoId, setEdicaoId] = useState('')
  const [papel, setPapel] = useState('')
  const [notas, setNotas] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  const buscar = useCallback(
    () =>
      Promise.all([listarParticipacoes(contactoId), listarEdicoes()]).then(([lista, todas]) => ({
        lista: lista.sort((a, b) => b.editions.event_date.localeCompare(a.editions.event_date)),
        todas,
      })),
    [contactoId],
  )

  const carregar = useCallback(
    () =>
      buscar().then(({ lista, todas }) => {
        setParticipacoes(lista)
        setEdicoes(todas)
      }),
    [buscar],
  )

  useEffect(() => {
    buscar().then(
      ({ lista, todas }) => {
        setParticipacoes(lista)
        setEdicoes(todas)
      },
      (error) => {
        console.error('carregar participações falhou:', error)
        setErro(LOAD_ERROR)
      },
    )
  }, [buscar])

  async function handleSubmit(event) {
    event.preventDefault()
    setAGravar(true)
    setErro('')
    try {
      await criarParticipacao({
        contacto_id: contactoId,
        edition_id: edicaoId,
        papel,
        notas: notas.trim() || null,
      })
      setEdicaoId('')
      setPapel('')
      setNotas('')
      await carregar()
    } catch (error) {
      console.error('gravar participação falhou:', error)
      setErro(SAVE_ERROR)
    } finally {
      setAGravar(false)
    }
  }

  async function handleRetirar(participacao) {
    if (!window.confirm(`Retirar a participação em ${participacao.editions.code}?`)) return
    setErro('')
    try {
      await apagarParticipacao(contactoId, participacao.edition_id)
      await carregar()
    } catch (error) {
      console.error('retirar participação falhou:', error)
      setErro(SAVE_ERROR)
    }
  }

  const ligadas = new Set((participacoes ?? []).map((item) => item.edition_id))
  const livres = edicoes.filter((edicao) => !ligadas.has(edicao.id))

  return (
    <section className="admin-section">
      <h2>Participações</h2>

      {participacoes &&
        (participacoes.length === 0 ? (
          <p>Ainda não participou em nenhuma edição.</p>
        ) : (
          <ul className="rede-historico">
            {participacoes.map((item) => (
              <li key={item.edition_id}>
                <p className="rede-historico-cabeca">
                  {nomeEdicao(item.editions)} · {rotulo(PAPEIS, item.papel)}
                </p>
                <p className="rede-historico-pe">{formatDate(item.editions.event_date)}</p>
                {item.notas && <p className="rede-texto">{item.notas}</p>}
                <button type="button" className="rede-ligacao-texto" onClick={() => handleRetirar(item)}>
                  Retirar
                </button>
              </li>
            ))}
          </ul>
        ))}

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}

      {participacoes && livres.length > 0 && (
        <form onSubmit={handleSubmit}>
          <h3>Acrescentar participação</h3>
          <label className="admin-field">
            <span>Edição</span>
            <select
              className="rede-select"
              required
              value={edicaoId}
              onChange={(event) => setEdicaoId(event.target.value)}
            >
              <option value="">Escolhe uma edição</option>
              {livres.map((edicao) => (
                <option key={edicao.id} value={edicao.id}>
                  {nomeEdicao(edicao)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Papel</span>
            <select className="rede-select" required value={papel} onChange={(event) => setPapel(event.target.value)}>
              <option value="">Escolhe o papel</option>
              {PAPEIS.map((item) => (
                <option key={item.valor} value={item.valor}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Notas (opcional)</span>
            <textarea className="rede-notas" rows={2} value={notas} onChange={(event) => setNotas(event.target.value)} />
          </label>
          <button type="submit" className="admin-button" disabled={aGravar}>
            {aGravar ? 'Um momento…' : 'Acrescentar'}
          </button>
        </form>
      )}
    </section>
  )
}
