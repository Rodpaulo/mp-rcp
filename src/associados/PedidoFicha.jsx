import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LOAD_ERROR, SAVE_ERROR, formatDate, yesNo } from '../admin/text.js'
import { FIM_FUNDADORES, anoDaQuota, dataBruxelas, euros } from '../../supabase/functions/_shared/campos.js'
import {
  ESTADOS_ABERTOS,
  admitirPedido,
  confirmarPagamento,
  lerConfiguracao,
  listarEnviosDoAssociado,
  listarEnviosDoPedido,
  listarPerfis,
  obterAssociadoDoPedido,
  obterPedido,
  registarSaida,
} from './api.js'
import Envios from './Envios.jsx'
import { ESTADOS_PEDIDO, SAIDAS, TIPOS_ASSOCIADO, rotulo } from './textos.js'

async function carregar(id) {
  const pedido = await obterPedido(id)
  if (!pedido) return null
  const [perfis, config, enviosPedido, associado] = await Promise.all([
    listarPerfis(),
    lerConfiguracao(),
    listarEnviosDoPedido(id),
    obterAssociadoDoPedido(id),
  ])
  const enviosAssociado = associado ? await listarEnviosDoAssociado(associado.id) : []
  const envios = [...enviosPedido, ...enviosAssociado].sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))
  return { pedido, perfis, config, envios, associado }
}

// As mensagens de admitir_pedido (migração 011, código P0001) e as do api.js (aviso) dizem o que falta.
function mensagemErro(error) {
  return error?.code === 'P0001' || error?.aviso ? error.message : SAVE_ERROR
}

// "Pagamento confirmado": data do pagamento (hoje por omissão, nunca no futuro).
function Pagamento({ pedido, onFeito }) {
  const hoje = dataBruxelas()
  const [data, setData] = useState(hoje)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setAGravar(true)
    setErro('')
    try {
      await confirmarPagamento(pedido.id, data)
      onFeito()
    } catch (error) {
      console.error('confirmar pagamento falhou:', error)
      setErro(mensagemErro(error))
      setAGravar(false)
    }
  }

  return (
    <form className="assoc-gesto" onSubmit={handleSubmit}>
      <h3>Pagamento confirmado</h3>
      <label className="admin-field">
        <span>Data do pagamento</span>
        <input type="date" required max={hoje} value={data} onChange={(event) => setData(event.target.value)} />
      </label>
      <p className="assoc-nota">
        {data <= FIM_FUNDADORES
          ? 'Pagamento até 31 de Dezembro de 2026: fica associado fundador ao admitir.'
          : 'Pagamento depois de 31 de Dezembro de 2026: não fica associado fundador.'}
      </p>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" className="admin-button" disabled={aGravar}>
        {aGravar ? 'Um momento…' : 'Pagamento confirmado'}
      </button>
    </form>
  )
}

// "Admitir": tipo, e o que vai acontecer, antes de carregar.
function Admitir({ pedido, config, onFeito }) {
  const [tipo, setTipo] = useState('efectivo')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const ano = anoDaQuota(dataBruxelas())
  const valor = euros(config[`valor_quota_${ano}`])
  const fundador = pedido.data_pagamento <= FIM_FUNDADORES

  async function handleSubmit(event) {
    event.preventDefault()
    setAGravar(true)
    setErro('')
    try {
      const r = await admitirPedido(pedido.id, tipo)
      onFeito(r)
    } catch (error) {
      console.error('admitir falhou:', error)
      setErro(mensagemErro(error))
      setAGravar(false)
    }
  }

  return (
    <form className="assoc-gesto" onSubmit={handleSubmit}>
      <h3>Admitir</h3>
      <fieldset className="assoc-grupo">
        <legend>Tipo de associado</legend>
        {TIPOS_ASSOCIADO.map((t) => (
          <label key={t.valor} className="assoc-opcao">
            <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => setTipo(t.valor)} />
            {t.rotulo}
          </label>
        ))}
      </fieldset>
      <ul className="assoc-nota">
        <li>
          {fundador
            ? `Fica associado fundador (pagamento a ${formatDate(pedido.data_pagamento)}).`
            : `Não fica associado fundador (pagamento a ${formatDate(pedido.data_pagamento)}).`}
        </li>
        <li>{valor ? `Fica com a quota de ${ano} paga (${valor}).` : `Falta o valor da quota de ${ano} na configuração.`}</li>
        <li>Recebe o número de associado seguinte.</li>
        <li>O email de boas-vindas ({fundador ? '9' : '10'}) sai na passagem seguinte da função diária, às 9h.</li>
      </ul>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" className="admin-button" disabled={aGravar || !valor}>
        {aGravar ? 'Um momento…' : 'Admitir'}
      </button>
    </form>
  )
}

// Saídas: desistiu, não admitido, cancelado, sempre com nota.
function Saida({ pedido, onFeito }) {
  const [estado, setEstado] = useState('')
  const [nota, setNota] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!estado) {
      setErro('Escolhe a saída.')
      return
    }
    if (!window.confirm(`Marcar este pedido como «${rotulo(SAIDAS, estado)}»? Os lembretes param.`)) return
    setAGravar(true)
    setErro('')
    try {
      await registarSaida(pedido, estado, rotulo(SAIDAS, estado), nota)
      onFeito()
    } catch (error) {
      console.error('registar saída falhou:', error)
      setErro(mensagemErro(error))
      setAGravar(false)
    }
  }

  return (
    <form className="assoc-gesto" onSubmit={handleSubmit}>
      <h3>Encerrar o pedido</h3>
      <fieldset className="assoc-grupo">
        <legend>Saída</legend>
        {SAIDAS.map((s) => (
          <label key={s.valor} className="assoc-opcao">
            <input type="radio" name="saida" value={s.valor} checked={estado === s.valor} onChange={() => setEstado(s.valor)} />
            {s.rotulo}
          </label>
        ))}
      </fieldset>
      <label className="admin-field">
        <span>Nota</span>
        <textarea className="assoc-texto-campo" rows={3} required value={nota} onChange={(event) => setNota(event.target.value)} />
      </label>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" className="admin-button-secondary" disabled={aGravar}>
        {aGravar ? 'Um momento…' : 'Encerrar o pedido'}
      </button>
    </form>
  )
}

export default function PedidoFicha({ id, onLista, onAbrirAssociado }) {
  const [dados, setDados] = useState(undefined) // undefined: a carregar; null: não existe
  const [erro, setErro] = useState(false)
  const [aviso, setAviso] = useState('')

  const recarregar = useCallback(() => {
    return carregar(id).then(setDados, (error) => {
      console.error('carregar pedido falhou:', error)
      setErro(true)
    })
  }, [id])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const voltar = (
    <button type="button" className="admin-button-secondary" onClick={onLista}>
      Voltar à lista
    </button>
  )

  if (erro || dados === null) {
    return (
      <section className="admin-section">
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este pedido não existe.'}
        </p>
        {voltar}
      </section>
    )
  }
  if (dados === undefined) return <p>A carregar…</p>

  const { pedido, perfis, config, envios, associado } = dados
  const nomePerfil = (perfilId) => perfis.find((p) => p.id === perfilId)?.nome
  const aberto = ESTADOS_ABERTOS.includes(pedido.estado)
  const manual = pedido.tally_id.startsWith('manual-')
  const boasVindas = associado && envios.find((e) => ['09_admissao_fundador', '10_admissao'].includes(e.email_tipo) && e.estado === 'enviado')

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>{pedido.nome_completo}</h2>
          {voltar}
        </div>
        <p>
          <span className={`assoc-estado assoc-estado-${pedido.estado}`}>{rotulo(ESTADOS_PEDIDO, pedido.estado)}</span>
        </p>

        {aviso && (
          <p className="assoc-aviso" role="status">
            {aviso}
          </p>
        )}

        <dl className="assoc-dados">
          <dt>Nome nos emails</dt>
          <dd>{pedido.nome_emails}</dd>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${pedido.email}`}>{pedido.email}</a>
          </dd>
          <dt>Pedido</dt>
          <dd>
            {formatDate(dataBruxelas(pedido.data_pedido))}
            {manual ? ' · criado à mão' : ' · Tally'}
          </dd>
          <dt>Aniversário</dt>
          <dd>{pedido.aniversario ?? '—'}</dd>
          <dt>Primeiro contacto</dt>
          <dd>{pedido.primeiro_contacto ?? '—'}</dd>
          <dt>Newsletter</dt>
          <dd>{yesNo(pedido.newsletter)}</dd>
          <dt>Consentimento</dt>
          <dd>{yesNo(pedido.consentimento)}</dd>
          {pedido.data_pagamento && (
            <>
              <dt>Pagamento</dt>
              <dd>
                {formatDate(pedido.data_pagamento)}
                {nomePerfil(pedido.pagamento_confirmado_por) && `, confirmado por ${nomePerfil(pedido.pagamento_confirmado_por)}`}
                {pedido.data_pagamento <= FIM_FUNDADORES ? ' · fundador' : ''}
              </dd>
            </>
          )}
          <dt>Contacto no Rede</dt>
          <dd>
            {pedido.contacto ? (
              <Link to={`/admin?s=rede&c=${pedido.contacto.id}`}>{pedido.contacto.nome}</Link>
            ) : (
              'nenhum ligado (liga-se ao admitir)'
            )}
          </dd>
          {associado && (
            <>
              <dt>Associado</dt>
              <dd>
                <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirAssociado(associado.id)}>
                  n.º {associado.numero}
                </button>
                {` · ${rotulo(TIPOS_ASSOCIADO, associado.tipo)}${associado.fundador ? ' · fundador' : ''}`}
              </dd>
              <dt>Boas-vindas</dt>
              <dd>
                {boasVindas
                  ? `email ${associado.fundador ? '9' : '10'} enviado`
                  : `email ${associado.fundador ? '9' : '10'} por enviar: sai na passagem seguinte da função diária, às 9h`}
              </dd>
            </>
          )}
        </dl>

        {pedido.notas && <p className="assoc-texto">{pedido.notas}</p>}

        {['recebido', 'instrucoes_enviadas'].includes(pedido.estado) && (
          <Pagamento
            pedido={pedido}
            onFeito={() => {
              setAviso('Pagamento confirmado. Os lembretes param.')
              recarregar()
            }}
          />
        )}
        {pedido.estado === 'pago' && (
          <Admitir
            pedido={pedido}
            config={config}
            onFeito={(r) => {
              setAviso(
                `Admitido com o n.º ${r.numero}${r.fundador ? ', associado fundador' : ''}; quota de ${r.ano_quota} paga. ` +
                  `O email ${r.fundador ? '9' : '10'} sai na passagem seguinte da função diária, às 9h.`,
              )
              recarregar()
            }}
          />
        )}
        {aberto && (
          <Saida
            pedido={pedido}
            onFeito={() => {
              setAviso('Pedido encerrado.')
              recarregar()
            }}
          />
        )}
      </section>

      <section className="admin-section">
        <h2>Emails</h2>
        <Envios envios={envios} onMudou={recarregar} />
      </section>
    </>
  )
}
