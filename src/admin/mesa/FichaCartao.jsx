// Cartão branco da ficha. O primeiro leva sobretítulo carmim e o nome em grande;
// os seguintes (histórico, emails, participações, quotas) só um título.
export default function FichaCartao({ sobretitulo, nome, titulo, children }) {
  return (
    <section className="mesa-cartao">
      {sobretitulo && <p className="mesa-sobretitulo">{sobretitulo}</p>}
      {nome && <h2 className="mesa-nome">{nome}</h2>}
      {titulo && <h2 className="mesa-cartao-titulo">{titulo}</h2>}
      {children}
    </section>
  )
}
