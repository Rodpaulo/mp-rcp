import { useSearchParams } from 'react-router-dom'
import Livro from './Livro.jsx'
import LivroForm from './LivroForm.jsx'
import Livros from './Livros.jsx'
import './Biblioteca.css'

// Secção Biblioteca do separador RCP (SPEC 15). Navegação por parâmetros no endereço:
//   /admin                  lista, no fim do separador RCP
//   /admin?b=novo           acrescentar livro
//   /admin?b=<id>           livro
//   /admin?b=<id>&m=editar  editar livro
export default function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams()
  const livro = searchParams.get('b')
  const modo = searchParams.get('m')

  const lista = (opcoes) => setSearchParams({}, opcoes)
  // Depois de gravar, substitui o formulário no histórico: o "Voltar" não reabre um formulário já gravado.
  const ficha = (id, opcoes) => setSearchParams({ b: id }, opcoes)

  if (livro === 'novo') {
    return <LivroForm key="novo" id={null} onVoltar={() => lista()} onGravado={(id) => ficha(id, { replace: true })} />
  }

  if (livro && modo === 'editar') {
    return (
      <LivroForm
        key={livro}
        id={livro}
        onVoltar={() => ficha(livro)}
        onGravado={() => ficha(livro, { replace: true })}
      />
    )
  }

  if (livro) {
    return (
      <Livro
        key={livro}
        id={livro}
        onLista={() => lista()}
        onEditar={() => setSearchParams({ b: livro, m: 'editar' })}
        onApagado={() => lista({ replace: true })}
      />
    )
  }

  return <Livros onAbrir={(id) => ficha(id)} onNovo={() => setSearchParams({ b: 'novo' })} />
}
