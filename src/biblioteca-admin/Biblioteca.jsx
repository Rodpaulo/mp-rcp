import { useSearchParams } from 'react-router-dom'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Mesa from '../admin/mesa/Mesa.jsx'
import Livro from './Livro.jsx'
import LivroForm from './LivroForm.jsx'
import Livros from './Livros.jsx'
import './Biblioteca.css'

// Separador Biblioteca do admin (SPEC 15 e 17.2). Navegação por parâmetros no endereço:
//   /admin?s=biblioteca     lista
//   /admin?b=novo           acrescentar livro
//   /admin?b=<id>           livro
//   /admin?b=<id>&m=editar  editar livro
// Em mesa de trabalho (SPEC 17.4): a lista fica à esquerda da ficha (no telemóvel, só a ficha).
export default function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams()
  const livro = searchParams.get('b')
  const modo = searchParams.get('m')

  const lista = (opcoes) => setSearchParams({ s: 'biblioteca' }, opcoes)
  // Depois de gravar, substitui o formulário no histórico: o "Voltar" não reabre um formulário já gravado.
  const ficha = (id, opcoes) => setSearchParams({ b: id }, opcoes)

  // A lista lê de novo quando se abre, grava ou fecha um livro: estados e títulos ficam em dia.
  const recarga = `${livro ?? ''}|${modo ?? ''}`

  let colunaFicha
  if (livro === 'novo') {
    colunaFicha = (
      <LivroForm key="novo" id={null} onVoltar={() => lista()} onGravado={(id) => ficha(id, { replace: true })} />
    )
  } else if (livro && modo === 'editar') {
    colunaFicha = (
      <LivroForm
        key={livro}
        id={livro}
        onVoltar={() => ficha(livro)}
        onGravado={() => ficha(livro, { replace: true })}
      />
    )
  } else if (livro) {
    colunaFicha = (
      <Livro
        key={livro}
        id={livro}
        onLista={() => lista()}
        onEditar={() => setSearchParams({ b: livro, m: 'editar' })}
        onApagado={() => lista({ replace: true })}
      />
    )
  } else {
    colunaFicha = (
      <FichaCartao>
        <p className="mesa-vazio">Escolhe um livro na lista.</p>
      </FichaCartao>
    )
  }

  return (
    <Mesa
      aberto={Boolean(livro)}
      lista={
        <Livros
          aberto={livro}
          recarga={recarga}
          onAbrir={(id) => ficha(id)}
          onNovo={() => setSearchParams({ b: 'novo' })}
        />
      }
    >
      {colunaFicha}
    </Mesa>
  )
}
