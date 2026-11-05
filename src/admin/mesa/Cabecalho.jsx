import { Link } from 'react-router-dom'
import { SEPARADORES } from './separadores.js'

// Cabeçalho branco fino: nome da associação, separadores, quem está com sessão e "Sair".
// Sem sessão (login), só o nome.
export default function Cabecalho({ separador, nome, onSair }) {
  return (
    <header className="mesa-cabecalho">
      <div className="mesa-cabecalho-dentro">
        <p className="mesa-marca">
          <span className="mesa-marca-leve">matinés</span> <span className="mesa-marca-forte">pensantes</span>
        </p>
        {separador && (
          <nav className="mesa-separadores" aria-label="Secções">
            {SEPARADORES.map((s) => (
              <Link
                key={s.valor}
                to={s.para}
                className="mesa-separador"
                aria-current={separador === s.valor ? 'page' : undefined}
              >
                {s.rotulo}
              </Link>
            ))}
          </nav>
        )}
        {onSair && (
          <div className="mesa-sessao">
            {nome && <span className="mesa-sessao-nome">{nome}</span>}
            <button type="button" className="mesa-sair" onClick={onSair}>
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
