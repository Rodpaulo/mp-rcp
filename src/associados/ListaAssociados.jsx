import { useEffect, useState } from 'react'
import ListaMesa, { ItemMesa } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR } from '../admin/text.js'
import { anoDaQuota, dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { listarAssociados } from './api.js'
import { ESTADOS_ASSOCIADO, TIPOS_ASSOCIADO, estadoDaQuota, nomeDoAssociado, rotulo } from './textos.js'

// Coluna da lista dos associados: número e nome, tipo, fundador e quota do ano na linha secundária.
export default function ListaAssociados({ aberto, recarga, onAbrir }) {
  const [associados, setAssociados] = useState(null)
  const [erro, setErro] = useState(false)
  const ano = anoDaQuota(dataBruxelas())

  useEffect(() => {
    listarAssociados().then(
      (lidos) => {
        setAssociados(lidos)
        setErro(false)
      },
      (error) => {
        console.error('carregar associados falhou:', error)
        setErro(true)
      },
    )
  }, [recarga])

  return (
    <ListaMesa titulo="Associados">
      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}
      {associados &&
        (associados.length === 0 ? (
          <p>Ainda não há associados. Admite-se a partir da ficha de um pedido pago.</p>
        ) : (
          <>
            <p className="mesa-contagem">
              {associados.length} associados · {associados.filter((a) => a.fundador).length} fundadores
            </p>
            <ul className="mesa-itens">
              {associados.map((a) => (
                <ItemMesa
                  key={a.id}
                  aberto={a.id === aberto}
                  onAbrir={() => onAbrir(a.id)}
                  nome={`N.º ${a.numero} · ${nomeDoAssociado(a)}`}
                  detalhe={[
                    rotulo(TIPOS_ASSOCIADO, a.tipo),
                    a.fundador && 'fundador',
                    `quota ${ano}: ${estadoDaQuota(a, ano)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  pilula={<Pilula estado={a.estado}>{rotulo(ESTADOS_ASSOCIADO, a.estado)}</Pilula>}
                />
              ))}
            </ul>
          </>
        ))}
    </ListaMesa>
  )
}
