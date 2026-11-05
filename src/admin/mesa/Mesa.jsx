// Mesa de trabalho (SPEC 17.4): lista à esquerda, ficha à direita.
// No telemóvel empilham-se: sem item aberto vê-se a lista; com item aberto, só a ficha.
export default function Mesa({ lista, aberto, children }) {
  return (
    <div className={aberto ? 'mesa mesa-aberta' : 'mesa'}>
      <div className="mesa-coluna-lista">{lista}</div>
      <div className="mesa-coluna-ficha">{children}</div>
    </div>
  )
}
