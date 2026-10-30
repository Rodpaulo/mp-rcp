import { useEffect, useState } from 'react'
import { LOAD_ERROR, SAVE_ERROR } from '../admin/text.js'
import {
  actualizarContacto,
  criarContacto,
  listarOrganizacoes,
  obterContacto,
  obterPessoa,
  procurarPessoaPorEmail,
} from './api.js'
import { ESTADOS, ETIQUETAS, TIPOS } from './listas.js'

const VAZIO = {
  tipo_registo: 'pessoa',
  nome: '',
  organizacao_id: '',
  person_id: null,
  etiquetas: [],
  estado: 'a_avaliar',
  email: '',
  telefone: '',
  cidade: '',
  website: '',
  origem: '',
  notas: '',
  pedido_adesao_em: '',
  proxima_revisao: '',
}

const TEXTOS = ['nome', 'email', 'telefone', 'cidade', 'website', 'origem', 'notas']

function normalizarEmail(email) {
  return (email ?? '').trim().toLowerCase()
}

// Da base para o formulário: null passa a '' nos campos de texto e de data.
function paraFormulario(contacto) {
  const form = { ...VAZIO }
  for (const chave of Object.keys(VAZIO)) {
    if (chave === 'person_id' || chave === 'etiquetas') form[chave] = contacto[chave] ?? VAZIO[chave]
    else form[chave] = contacto[chave] ?? ''
  }
  return form
}

// Do formulário para a base: texto aparado, vazio passa a null.
function paraBase(form) {
  const dados = {
    tipo_registo: form.tipo_registo,
    estado: form.estado,
    etiquetas: form.etiquetas,
    person_id: form.person_id,
    organizacao_id: form.tipo_registo === 'pessoa' && form.organizacao_id ? form.organizacao_id : null,
    proxima_revisao: form.proxima_revisao || null,
    // A base só aceita a data do pedido de adesão com a etiqueta "associado".
    pedido_adesao_em: form.etiquetas.includes('associado') && form.pedido_adesao_em ? form.pedido_adesao_em : null,
  }
  for (const chave of TEXTOS) {
    dados[chave] = form[chave].trim() || null
  }
  if (dados.email) dados.email = normalizarEmail(dados.email)
  return dados
}

export default function ContactoForm({ id, onVoltar, onGravado }) {
  const [form, setForm] = useState(id ? null : VAZIO)
  const [organizacoes, setOrganizacoes] = useState([])
  const [pessoa, setPessoa] = useState(null) // registo de people já ligado
  const [proposta, setProposta] = useState(null) // registo de people com o mesmo email, por confirmar
  const [recusado, setRecusado] = useState('') // email cuja proposta de ligação foi recusada
  const [aviso, setAviso] = useState('')
  const [erroCarregar, setErroCarregar] = useState(false)
  const [naoExiste, setNaoExiste] = useState(false)
  const [erroGravar, setErroGravar] = useState(false)
  const [aGravar, setAGravar] = useState(false)

  useEffect(() => {
    let activo = true
    async function carregar() {
      try {
        const [orgs, contacto] = await Promise.all([listarOrganizacoes(), id ? obterContacto(id) : null])
        if (!activo) return
        setOrganizacoes(orgs.filter((org) => org.id !== id))
        if (!id) return
        if (!contacto) {
          setNaoExiste(true)
          return
        }
        setForm(paraFormulario(contacto))
        if (contacto.person_id) {
          const ligada = await obterPessoa(contacto.person_id)
          if (activo) setPessoa(ligada)
        }
      } catch (error) {
        console.error('carregar contacto falhou:', error)
        if (activo) setErroCarregar(true)
      }
    }
    carregar()
    return () => {
      activo = false
    }
  }, [id])

  function mudar(chave, valor) {
    setForm((actual) => ({ ...actual, [chave]: valor }))
  }

  function mudarEtiqueta(valor, marcada) {
    setForm((actual) => ({
      ...actual,
      etiquetas: marcada ? [...actual.etiquetas, valor] : actual.etiquetas.filter((item) => item !== valor),
    }))
  }

  function mudarEmail(valor) {
    mudar('email', valor)
    setProposta(null)
    // A ligação a people só vale enquanto o email coincidir.
    if (pessoa && normalizarEmail(valor) !== normalizarEmail(pessoa.email)) {
      setPessoa(null)
      mudar('person_id', null)
      setAviso('A ligação ao registo do RCP foi retirada porque o email mudou.')
    }
  }

  async function verificarEmail() {
    const email = normalizarEmail(form.email)
    if (!email || form.person_id || email === recusado) return
    try {
      const encontrada = await procurarPessoaPorEmail(email)
      setProposta(encontrada)
    } catch (error) {
      // Sem a proposta, o contacto grava-se na mesma.
      console.error('procurar email no RCP falhou:', error)
    }
  }

  function ligar() {
    setPessoa(proposta)
    mudar('person_id', proposta.id)
    setProposta(null)
    setAviso('')
  }

  function naoLigar() {
    setRecusado(normalizarEmail(form.email))
    setProposta(null)
  }

  function desligar() {
    setRecusado(normalizarEmail(form.email))
    setPessoa(null)
    mudar('person_id', null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setAGravar(true)
    setErroGravar(false)
    try {
      const dados = paraBase(form)
      const gravado = id ? await actualizarContacto(id, dados) : await criarContacto(dados)
      onGravado(gravado.id)
    } catch (error) {
      console.error('gravar contacto falhou:', error)
      setErroGravar(true)
      setAGravar(false)
    }
  }

  const voltar = (
    <button type="button" className="admin-button-secondary" onClick={onVoltar}>
      {id ? 'Voltar à ficha' : 'Voltar à lista'}
    </button>
  )

  if (naoExiste || erroCarregar) {
    return (
      <section className="admin-section">
        <p className={erroCarregar ? 'admin-error' : undefined} role="alert">
          {erroCarregar ? LOAD_ERROR : 'Este contacto não existe.'}
        </p>
        {voltar}
      </section>
    )
  }

  if (!form) return <p>A carregar…</p>

  const ePessoa = form.tipo_registo === 'pessoa'

  return (
    <form className="admin-section rede-form" onSubmit={handleSubmit}>
      <div className="admin-section-head">
        <h2>{id ? 'Editar contacto' : 'Novo contacto'}</h2>
        {voltar}
      </div>

      <fieldset className="rede-grupo">
        <legend>Tipo</legend>
        {TIPOS.map((tipo) => (
          <label key={tipo.valor} className="rede-opcao">
            <input
              type="radio"
              name="tipo_registo"
              value={tipo.valor}
              checked={form.tipo_registo === tipo.valor}
              onChange={() => mudar('tipo_registo', tipo.valor)}
            />
            {tipo.rotulo}
          </label>
        ))}
      </fieldset>

      <label className="admin-field">
        <span>Nome</span>
        <input required value={form.nome} onChange={(event) => mudar('nome', event.target.value)} />
      </label>

      {ePessoa && (
        <label className="admin-field">
          <span>Organização (opcional)</span>
          <select
            className="rede-select"
            value={form.organizacao_id}
            onChange={(event) => mudar('organizacao_id', event.target.value)}
          >
            <option value="">Nenhuma</option>
            {organizacoes.map((org) => (
              <option key={org.id} value={org.id}>
                {org.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="rede-grupo">
        <legend>Etiquetas</legend>
        {ETIQUETAS.map((item) => (
          <label key={item.valor} className="rede-opcao">
            <input
              type="checkbox"
              checked={form.etiquetas.includes(item.valor)}
              onChange={(event) => mudarEtiqueta(item.valor, event.target.checked)}
            />
            {item.rotulo}
          </label>
        ))}
      </fieldset>

      {form.etiquetas.includes('associado') && (
        <label className="admin-field">
          <span>Pedido de adesão em (opcional)</span>
          <input
            type="date"
            value={form.pedido_adesao_em}
            onChange={(event) => mudar('pedido_adesao_em', event.target.value)}
          />
        </label>
      )}

      <label className="admin-field">
        <span>Estado</span>
        <select className="rede-select" value={form.estado} onChange={(event) => mudar('estado', event.target.value)}>
          {ESTADOS.map((item) => (
            <option key={item.valor} value={item.valor}>
              {item.rotulo}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        <span>Email (opcional)</span>
        <input
          type="email"
          autoCapitalize="off"
          inputMode="email"
          value={form.email}
          onChange={(event) => mudarEmail(event.target.value)}
          onBlur={verificarEmail}
        />
      </label>

      {proposta && (
        <div className="rede-ligacao" role="status">
          <p>
            Este email já está no registo do RCP
            {proposta.name ? ` (${proposta.name})` : ''}. Queres ligar este contacto a esse registo?
          </p>
          <div className="admin-inline">
            <button type="button" className="admin-button" onClick={ligar}>
              Ligar
            </button>
            <button type="button" className="admin-button-secondary" onClick={naoLigar}>
              Não ligar
            </button>
          </div>
        </div>
      )}

      {pessoa && (
        <div className="rede-ligacao">
          <p>
            Ligado ao registo do RCP: {pessoa.email}
            {pessoa.name ? ` (${pessoa.name})` : ''}.
          </p>
          <button type="button" className="admin-button-secondary" onClick={desligar}>
            Desligar
          </button>
        </div>
      )}

      {aviso && <p className="rede-aviso">{aviso}</p>}

      <label className="admin-field">
        <span>Telefone (opcional)</span>
        <input type="tel" value={form.telefone} onChange={(event) => mudar('telefone', event.target.value)} />
      </label>

      <label className="admin-field">
        <span>Cidade (opcional)</span>
        <input value={form.cidade} onChange={(event) => mudar('cidade', event.target.value)} />
      </label>

      <label className="admin-field">
        <span>Website (opcional)</span>
        <input
          inputMode="url"
          autoCapitalize="off"
          placeholder="https://"
          value={form.website}
          onChange={(event) => mudar('website', event.target.value)}
        />
      </label>

      <label className="admin-field">
        <span>Origem (opcional)</span>
        <input
          placeholder="Como chegou até nós"
          value={form.origem}
          onChange={(event) => mudar('origem', event.target.value)}
        />
      </label>

      <label className="admin-field">
        <span>Próxima revisão (opcional)</span>
        <input
          type="date"
          value={form.proxima_revisao}
          onChange={(event) => mudar('proxima_revisao', event.target.value)}
        />
      </label>

      <label className="admin-field">
        <span>Notas (opcional)</span>
        <textarea className="rede-notas" rows={4} value={form.notas} onChange={(event) => mudar('notas', event.target.value)} />
      </label>

      {erroGravar && (
        <p className="admin-error" role="alert">
          {SAVE_ERROR}
        </p>
      )}

      <button type="submit" className="admin-button" disabled={aGravar}>
        {aGravar ? 'Um momento…' : 'Gravar'}
      </button>
    </form>
  )
}
