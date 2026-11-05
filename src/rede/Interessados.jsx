import { useCallback, useEffect, useState } from 'react'
import { ItemMesa } from '../admin/mesa/ListaMesa.jsx'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { criarContacto, listarInteressados } from './api.js'
import { diaLocal, porExtenso } from './datas.js'

// Quem pediu, na página de entrada, para ser contactado sobre a adesão. people só se lê;
// "Criar contacto" escreve só em contactos.
export default function Interessados({ aberto, recarga, onAbrir }) {
  const [pessoas, setPessoas] = useState(null)
  const [erro, setErro] = useState('')
  const [aCriar, setACriar] = useState(null)

  const carregar = useCallback(
    () =>
      listarInteressados().then(setPessoas, (error) => {
        console.error('carregar interessados falhou:', error)
        setErro(LOAD_ERROR)
      }),
    [],
  )

  useEffect(() => {
    carregar()
  }, [carregar, recarga])

  async function handleCriar(pessoa) {
    setACriar(pessoa.id)
    setErro('')
    try {
      const gravado = await criarContacto({
        tipo_registo: 'pessoa',
        // Quem entra só com o email não tem nome em people: fica o email, corrige-se em "Editar".
        nome: pessoa.name?.trim() || pessoa.email,
        email: pessoa.email,
        etiquetas: ['associado'],
        pedido_adesao_em: diaLocal(pessoa.associado_interesse_at),
        person_id: pessoa.id,
        estado: 'a_avaliar',
      })
      onAbrir(gravado.id)
    } catch (error) {
      console.error('criar contacto falhou:', error)
      setErro(SAVE_ERROR)
    } finally {
      setACriar(null)
    }
  }

  return (
    <>
      <p className="mesa-contagem">Interessados em ser associados</p>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      {pessoas &&
        (pessoas.length === 0 ? (
          <p>Ainda ninguém pediu para ser contactado.</p>
        ) : (
          <ul className="mesa-itens">
            {pessoas.map((pessoa) => (
              <ItemMesa
                key={pessoa.id}
                aberto={Boolean(pessoa.contacto_id) && pessoa.contacto_id === aberto}
                onAbrir={pessoa.contacto_id ? () => onAbrir(pessoa.contacto_id) : undefined}
                nome={pessoa.name || 'Sem nome'}
                detalhe={
                  `${pessoa.email} · pediu a ${porExtenso(diaLocal(pessoa.associado_interesse_at))}` +
                  (pessoa.contacto_id ? ' · já tem contacto no Rede' : ' · ainda sem contacto no Rede')
                }
              >
                {!pessoa.contacto_id && (
                  <button
                    type="button"
                    className="mesa-item-accao"
                    onClick={() => handleCriar(pessoa)}
                    disabled={aCriar === pessoa.id}
                  >
                    {aCriar === pessoa.id ? 'Um momento…' : 'Criar contacto'}
                  </button>
                )}
              </ItemMesa>
            ))}
          </ul>
        ))}
    </>
  )
}
