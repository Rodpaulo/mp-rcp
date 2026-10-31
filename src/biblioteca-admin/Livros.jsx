import { useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { listarLivros } from './api.js'
import { ESTADOS, quemTrouxe, rotuloEstado } from './livros.js'

function corresponde(livro, pesquisa, estado) {
  if (estado && livro.status !== estado) return false
  if (!pesquisa) return true
  const texto = pesquisa.trim().toLowerCase()
  // "12" encontra BC-012: compara também só os algarismos do número.
  const algarismos = texto.replace(/\D/g, '')
  return (
    livro.title.toLowerCase().includes(texto) ||
    livro.number.toLowerCase().includes(texto) ||
    (algarismos !== '' && livro.number.replace(/\D/g, '').replace(/^0+/, '') === algarismos.replace(/^0+/, ''))
  )
}

// Lista dos livros, no fim do separador RCP.
export default function Livros({ onAbrir, onNovo }) {
  const [livros, setLivros] = useState(null)
  const [erro, setErro] = useState(false)
  const [pesquisa, setPesquisa] = useState('')
  const [estado, setEstado] = useState('')

  useEffect(() => {
    listarLivros().then(setLivros, (error) => {
      console.error('carregar livros falhou:', error)
      setErro(true)
    })
  }, [])

  const visiveis = (livros ?? []).filter((livro) => corresponde(livro, pesquisa, estado))

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Biblioteca</h2>
        <button type="button" className="admin-button" onClick={onNovo}>
          Acrescentar livro
        </button>
      </div>

      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {livros && (
        <>
          <div className="biblioteca-filtros">
            <label className="admin-field">
              <span>Pesquisar por número ou título</span>
              <input type="search" value={pesquisa} onChange={(event) => setPesquisa(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Estado</span>
              <select className="biblioteca-select" value={estado} onChange={(event) => setEstado(event.target.value)}>
                <option value="">Todos</option>
                {ESTADOS.map((item) => (
                  <option key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="biblioteca-contagem">
            {visiveis.length === livros.length
              ? `${livros.length} ${livros.length === 1 ? 'livro' : 'livros'}`
              : `${visiveis.length} de ${livros.length} livros`}
          </p>

          {visiveis.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Título</th>
                    <th scope="col">Autor</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Entrada</th>
                    <th scope="col">Quem trouxe</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((livro) => (
                    <tr key={livro.id}>
                      <td>
                        <button type="button" className="biblioteca-ligacao" onClick={() => onAbrir(livro.id)}>
                          {livro.number}
                        </button>
                      </td>
                      <td>{livro.title}</td>
                      <td>{livro.author}</td>
                      <td>{rotuloEstado(livro.status)}</td>
                      <td>{livro.editions?.code}</td>
                      <td>{quemTrouxe(livro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
