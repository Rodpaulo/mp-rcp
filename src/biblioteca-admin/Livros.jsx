import { useEffect, useState } from 'react'
import ListaMesa, { ItemMesa, PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR } from '../admin/text.js'
import { listarLivros } from './api.js'
import { ESTADOS, quemTrouxe, rotuloEstado } from './livros.js'

const FILTRO_ESTADO = [{ valor: '', rotulo: 'Todos' }, ...ESTADOS]

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

// Coluna da lista dos livros, no separador Biblioteca. recarga muda quando se abre, grava ou fecha um livro.
export default function Livros({ aberto, recarga, onAbrir, onNovo }) {
  const [livros, setLivros] = useState(null)
  const [erro, setErro] = useState(false)
  const [pesquisa, setPesquisa] = useState('')
  const [estado, setEstado] = useState('')

  useEffect(() => {
    listarLivros().then(
      (lidos) => {
        setLivros(lidos)
        setErro(false)
      },
      (error) => {
        console.error('carregar livros falhou:', error)
        setErro(true)
      },
    )
  }, [recarga])

  const visiveis = (livros ?? []).filter((livro) => corresponde(livro, pesquisa, estado))

  return (
    <ListaMesa
      titulo="Biblioteca"
      accao={
        <button type="button" className="mesa-botao" onClick={onNovo}>
          Acrescentar livro
        </button>
      }
    >
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {livros && (
        <>
          <label className="admin-field mesa-pesquisa">
            <span>Pesquisar por número ou título</span>
            <input type="search" value={pesquisa} onChange={(event) => setPesquisa(event.target.value)} />
          </label>
          <PilulasFiltro rotulo="Estado" opcoes={FILTRO_ESTADO} valor={estado} onMudar={setEstado} />

          <p className="mesa-contagem">
            {visiveis.length === livros.length
              ? `${livros.length} ${livros.length === 1 ? 'livro' : 'livros'}`
              : `${visiveis.length} de ${livros.length} livros`}
          </p>

          {visiveis.length > 0 && (
            <ul className="mesa-itens">
              {visiveis.map((livro) => (
                <ItemMesa
                  key={livro.id}
                  aberto={livro.id === aberto}
                  onAbrir={() => onAbrir(livro.id)}
                  nome={`${livro.number} · ${livro.title}`}
                  detalhe={[livro.author, livro.editions?.code && `entrada no ${livro.editions.code}`, quemTrouxe(livro)]
                    .filter(Boolean)
                    .join(' · ')}
                  pilula={<Pilula estado={livro.status}>{rotuloEstado(livro.status)}</Pilula>}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </ListaMesa>
  )
}
