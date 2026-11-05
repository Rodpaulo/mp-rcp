// Números da barra do separador Biblioteca (SPEC 17.3): os livros que a secção já lê
// e, para as entradas, a linha da edição aberta na vista biblioteca_resumo.

import { lerResumoDaEdicao, listarLivros, obterEdicaoAberta } from './api.js'

export async function lerNumerosBiblioteca() {
  const [livros, aberta] = await Promise.all([listarLivros(), obterEdicaoAberta()])
  const resumo = aberta ? await lerResumoDaEdicao(aberta.code) : null
  const conta = (estado) => livros.filter((l) => l.status === estado).length
  return [
    { rotulo: 'Na mesa', numero: conta('na_mesa') },
    { rotulo: 'Levados', numero: conta('levado') },
    { rotulo: 'Desaparecidos', numero: conta('desaparecido') },
    {
      rotulo: aberta ? `Entradas no ${aberta.code}` : 'Entradas (sem edição aberta)',
      numero: resumo ? Number(resumo.entradas) : null,
    },
  ]
}
