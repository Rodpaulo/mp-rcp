// Coluna da lista: título (com a acção ao lado), filtros em pílulas e os itens.

export default function ListaMesa({ titulo, accao, children }) {
  return (
    <section className="mesa-lista">
      <div className="mesa-lista-cabeca">
        <h2>{titulo}</h2>
        {accao}
      </div>
      {children}
    </section>
  )
}

// Pílulas de filtro: uma escolhida de cada vez (aria-pressed).
export function PilulasFiltro({ rotulo, opcoes, valor, onMudar }) {
  return (
    <div className="mesa-filtros" role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          className="mesa-filtro"
          aria-pressed={valor === opcao.valor}
          onClick={() => onMudar(opcao.valor)}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}

// Vistas de um separador (Associados): uma linha de texto em maiúsculas, a escolhida sublinhada.
// Mais discretas do que as pílulas de filtro, para não se confundirem com elas.
export function VistasMesa({ rotulo, opcoes, valor, onMudar }) {
  return (
    <div className="mesa-vistas" role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          className="mesa-vista"
          aria-pressed={valor === opcao.valor}
          onClick={() => onMudar(opcao.valor)}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}

// Item da lista: nome, linha secundária e pílula à direita; o aberto leva a barra carmim.
// Sem onAbrir, o item não abre nada (por exemplo, um interessado ainda sem contacto).
// children: o que fica por baixo, como um botão de acção da própria linha.
export function ItemMesa({ aberto, onAbrir, nome, detalhe, pilula, children }) {
  const conteudo = (
    <>
      <span className="mesa-item-nome">{nome}</span>
      {pilula}
      {detalhe && <span className="mesa-item-detalhe">{detalhe}</span>}
    </>
  )
  return (
    <li className="mesa-item" aria-current={aberto ? 'true' : undefined}>
      {onAbrir ? (
        <button type="button" className="mesa-item-linha" onClick={onAbrir}>
          {conteudo}
        </button>
      ) : (
        <div className="mesa-item-linha">{conteudo}</div>
      )}
      {children && <div className="mesa-item-extra">{children}</div>}
    </li>
  )
}
