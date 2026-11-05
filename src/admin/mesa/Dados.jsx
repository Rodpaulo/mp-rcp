// Dados da ficha em grelha: rótulo pequeno em maiúsculas, valor por baixo. Os vazios não aparecem.
export default function Dados({ itens }) {
  const visiveis = itens.filter((item) => item.valor)
  if (visiveis.length === 0) return null
  return (
    <dl className="mesa-dados">
      {visiveis.map((item) => (
        <div key={item.rotulo}>
          <dt>{item.rotulo}</dt>
          <dd>{item.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
