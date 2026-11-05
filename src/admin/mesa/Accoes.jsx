// Linha de acções da ficha: as acções à esquerda (a principal primeiro);
// as saídas (encerrar, apagar) em texto cinzento, à direita.
export default function Accoes({ children, saidas }) {
  return (
    <div className="mesa-accoes">
      <div className="mesa-accoes-principais">{children}</div>
      {saidas && <div className="mesa-accoes-saidas">{saidas}</div>}
    </div>
  )
}
