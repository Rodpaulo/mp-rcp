import { useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import { actualizarContacto, criarRevisao, listarPerfis, obterContacto, obterUtilizadorId } from './api.js'
import { erroCartao } from './accoes.js'
import { hoje, somarMeses } from './datas.js'
import { DECISOES, ESTADOS, ESTADO_POR_DECISAO, INICIO_CARTAO_TRELLO, rotulo } from './listas.js'

const MESES_ATE_PROXIMA = 12

export default function RevisaoForm({ contactoId, onVoltar, onGravado }) {
  const [nome, setNome] = useState('')
  const [perfis, setPerfis] = useState([])
  const [data, setData] = useState(hoje())
  const [decisao, setDecisao] = useState('')
  const [accao, setAccao] = useState('')
  const [prazo, setPrazo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [cartao, setCartao] = useState('')
  const [proxima, setProxima] = useState(somarMeses(hoje(), MESES_ATE_PROXIMA))
  const [proximaMexida, setProximaMexida] = useState(false)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const [gravadaSemProxima, setGravadaSemProxima] = useState(false)

  useEffect(() => {
    Promise.all([obterContacto(contactoId), listarPerfis(), obterUtilizadorId()]).then(
      ([contacto, lista, utilizador]) => {
        setNome(contacto?.nome ?? '')
        setPerfis(lista)
        if (lista.some((perfil) => perfil.id === utilizador)) setResponsavel(utilizador)
      },
      (error) => {
        console.error('carregar revisão falhou:', error)
        setErro(LOAD_ERROR)
      },
    )
  }, [contactoId])

  function mudarData(valor) {
    setData(valor)
    // A próxima revisão acompanha a data, a 12 meses, até alguém a mudar à mão.
    if (!proximaMexida && valor) setProxima(somarMeses(valor, MESES_ATE_PROXIMA))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const textoAccao = accao.trim()
    const enderecoCartao = textoAccao ? cartao.trim() : ''
    if (!decisao) {
      setErro('Escolhe a decisão.')
      return
    }
    if (erroCartao(enderecoCartao)) {
      setErro(erroCartao(enderecoCartao))
      return
    }
    setAGravar(true)
    setErro('')
    try {
      await criarRevisao({
        contacto_id: contactoId,
        data,
        decisao,
        // Prazo, responsável e cartão só existem com acção (a base exige acção quando há prazo).
        accao: textoAccao || null,
        prazo: textoAccao && prazo ? prazo : null,
        responsavel: textoAccao && responsavel ? responsavel : null,
        cartao_trello: enderecoCartao || null,
      })
    } catch (error) {
      console.error('gravar revisão falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
      return
    }
    try {
      await actualizarContacto(contactoId, {
        proxima_revisao: proxima || null,
        estado: ESTADO_POR_DECISAO[decisao],
      })
      onGravado()
    } catch (error) {
      // A revisão já está gravada: não a gravar de novo.
      console.error('actualizar próxima revisão e estado falhou:', error)
      setGravadaSemProxima(true)
      setAGravar(false)
    }
  }

  if (gravadaSemProxima) {
    return (
      <section className="admin-section">
        <p className="admin-error" role="alert">
          A revisão ficou gravada, mas a próxima revisão e o estado do contacto não. Corrige-os em "Editar", na ficha.
        </p>
        <button type="button" className="admin-button" onClick={onGravado}>
          Ir para a ficha
        </button>
      </section>
    )
  }

  return (
    <form className="admin-section rede-form" onSubmit={handleSubmit}>
      <div className="admin-section-head">
        <h2>Revisão{nome && ` de ${nome}`}</h2>
        <button type="button" className="admin-button-secondary" onClick={onVoltar}>
          Voltar
        </button>
      </div>

      <label className="admin-field">
        <span>Data</span>
        <input type="date" required value={data} onChange={(event) => mudarData(event.target.value)} />
      </label>

      <fieldset className="rede-grupo">
        <legend>Decisão</legend>
        <div className="rede-botoes-escolha">
          {DECISOES.map((item) => (
            <label key={item.valor} className="rede-escolha">
              <input
                type="radio"
                name="decisao"
                value={item.valor}
                checked={decisao === item.valor}
                onChange={() => setDecisao(item.valor)}
              />
              <span>{item.rotulo}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="admin-field">
        <span>Acção seguinte (opcional)</span>
        <textarea className="rede-notas" rows={3} value={accao} onChange={(event) => setAccao(event.target.value)} />
      </label>

      {accao.trim() && (
        <>
          <label className="admin-field">
            <span>Prazo (opcional)</span>
            <input type="date" value={prazo} onChange={(event) => setPrazo(event.target.value)} />
          </label>
          <label className="admin-field">
            <span>Responsável</span>
            <select
              className="rede-select"
              value={responsavel}
              onChange={(event) => setResponsavel(event.target.value)}
            >
              <option value="">Ninguém em particular</option>
              {perfis.map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Cartão Trello (opcional)</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder={`${INICIO_CARTAO_TRELLO}c/…`}
              value={cartao}
              onChange={(event) => setCartao(event.target.value)}
            />
          </label>
        </>
      )}

      <label className="admin-field">
        <span>Próxima revisão</span>
        <input
          type="date"
          value={proxima}
          onChange={(event) => {
            setProxima(event.target.value)
            setProximaMexida(true)
          }}
        />
      </label>

      {decisao && (
        <p className="rede-aviso-estado" role="status">
          Ao gravar, o estado passa a {rotulo(ESTADOS, ESTADO_POR_DECISAO[decisao])}.
        </p>
      )}

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}

      <div className="rede-gravar">
        <button type="submit" className="admin-button" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Gravar revisão'}
        </button>
      </div>
    </form>
  )
}
