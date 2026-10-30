import { useCallback, useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { criarContacto, listarInteressados } from './api.js'
import { diaLocal, porExtenso } from './datas.js'

// Quem pediu, na página de entrada, para ser contactado sobre a adesão. people só se lê;
// "Criar contacto" escreve só em contactos.
export default function Interessados({ onAbrir }) {
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
  }, [carregar])

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
      setACriar(null)
    }
  }

  return (
    <section className="admin-section">
      <h2>Interessados em ser associados</h2>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      {pessoas &&
        (pessoas.length === 0 ? (
          <p>Ainda ninguém pediu para ser contactado.</p>
        ) : (
          <ul className="rede-historico">
            {pessoas.map((pessoa) => (
              <li key={pessoa.id}>
                <p className="rede-historico-cabeca">{pessoa.name || 'Sem nome'}</p>
                <p className="rede-texto">{pessoa.email}</p>
                <p className="rede-historico-pe">
                  Pediu a {porExtenso(diaLocal(pessoa.associado_interesse_at))}
                  {pessoa.contacto_id ? ' · já tem contacto no Rede' : ' · ainda sem contacto no Rede'}
                </p>
                {pessoa.contacto_id ? (
                  <button
                    type="button"
                    className="admin-button-secondary rede-botao-lista"
                    onClick={() => onAbrir(pessoa.contacto_id)}
                  >
                    Abrir contacto
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-button rede-botao-lista"
                    onClick={() => handleCriar(pessoa)}
                    disabled={aCriar === pessoa.id}
                  >
                    {aCriar === pessoa.id ? 'Um momento…' : 'Criar contacto'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
