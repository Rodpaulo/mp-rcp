import { useEffect, useState } from 'react'

// Barra de quatro números por baixo do cabeçalho (SPEC 17.3).
// `ler()` devolve [{ rotulo, numero, pedeAccao? }]; lê de novo quando `chave` muda e,
// com `intervalo` (ms), enquanto a barra estiver montada.
// O quarto cartão fica turquesa quando pede acção e o número é maior do que zero.
export default function BarraNumeros({ ler, chave, intervalo }) {
  const [cartoes, setCartoes] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let activo = true
    const carregar = () =>
      ler().then(
        (novos) => {
          if (!activo) return
          setCartoes(novos)
          setErro(false)
        },
        (error) => {
          console.error('carregar números falhou:', error)
          if (activo) setErro(true)
        },
      )
    carregar()
    const id = intervalo ? setInterval(carregar, intervalo) : null
    return () => {
      activo = false
      if (id) clearInterval(id)
    }
  }, [ler, chave, intervalo])

  if (!cartoes) {
    return (
      <div className="mesa-barra" aria-busy={!erro}>
        <div className="mesa-barra-dentro">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mesa-cartao-numero">
              <strong>{erro ? '—' : '…'}</strong>
              <span>{erro && i === 0 ? 'Não foi possível carregar.' : ' '}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mesa-barra">
      <dl className="mesa-barra-dentro">
        {cartoes.map((c) => {
          const alerta = c.pedeAccao && typeof c.numero === 'number' && c.numero > 0
          return (
            <div key={c.rotulo} className={`mesa-cartao-numero${alerta ? ' mesa-cartao-alerta' : ''}`}>
              <dd>{c.numero ?? '—'}</dd>
              <dt>{c.rotulo}</dt>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
