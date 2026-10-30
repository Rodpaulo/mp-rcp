import { useEffect, useState } from 'react'
import { SAVE_ERROR } from '../admin/text.js'
import { criarInteraccao, obterContacto } from './api.js'
import { hoje } from './datas.js'
import { CANAIS } from './listas.js'

// Pensado para o telemóvel, com uma mão: canal em botões grandes, data já em hoje,
// resumo, e o botão de gravar sempre à vista no fundo do ecrã.
export default function InteraccaoForm({ contactoId, onVoltar, onGravado }) {
  const [nome, setNome] = useState('')
  const [canal, setCanal] = useState('')
  const [data, setData] = useState(hoje())
  const [resumo, setResumo] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    obterContacto(contactoId).then(
      (contacto) => setNome(contacto?.nome ?? ''),
      (error) => console.error('carregar contacto falhou:', error),
    )
  }, [contactoId])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canal) {
      setErro('Escolhe o canal.')
      return
    }
    setAGravar(true)
    setErro('')
    try {
      await criarInteraccao({ contacto_id: contactoId, canal, data, resumo: resumo.trim() })
      onGravado()
    } catch (error) {
      console.error('gravar interacção falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
    }
  }

  return (
    <form className="admin-section rede-form" onSubmit={handleSubmit}>
      <div className="admin-section-head">
        <h2>Interacção{nome && ` com ${nome}`}</h2>
        <button type="button" className="admin-button-secondary" onClick={onVoltar}>
          Voltar
        </button>
      </div>

      <fieldset className="rede-grupo">
        <legend>Canal</legend>
        <div className="rede-botoes-escolha">
          {CANAIS.map((item) => (
            <label key={item.valor} className="rede-escolha">
              <input
                type="radio"
                name="canal"
                value={item.valor}
                checked={canal === item.valor}
                onChange={() => setCanal(item.valor)}
              />
              <span>{item.rotulo}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="admin-field">
        <span>Data</span>
        <input type="date" required max={hoje()} value={data} onChange={(event) => setData(event.target.value)} />
      </label>

      <label className="admin-field">
        <span>Resumo</span>
        <textarea
          className="rede-notas"
          rows={4}
          required
          value={resumo}
          onChange={(event) => setResumo(event.target.value)}
        />
      </label>

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}

      <div className="rede-gravar">
        <button type="submit" className="admin-button" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Gravar interacção'}
        </button>
      </div>
    </form>
  )
}
