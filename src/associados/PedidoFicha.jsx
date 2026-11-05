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
import Accoes from '../admin/mesa/Accoes.jsx'
import Dados from '../admin/mesa/Dados.jsx'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'

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
// Abre a partir de "Encerrar o pedido", nas saídas da ficha (SPEC 17.4).
function Saida({ pedido, onFeito, onCancelar }) {
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
      <div className="assoc-accoes">
        <button type="submit" className="admin-button-secondary" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Encerrar o pedido'}
        </button>
        <button type="button" className="mesa-saida" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function PedidoFicha({ id, onLista, onAbrirAssociado }) {
  const [dados, setDados] = useState(undefined) // undefined: a carregar; null: não existe
  const [erro, setErro] = useState(false)
  const [aviso, setAviso] = useState('')
  const [aEncerrar, setAEncerrar] = useState(false)

  const recarregar = useCallback(() => {
    return carregar(id).then(setDados, (error) => {
      console.error('carregar pedido falhou:', error)
      setErro(true)
    })
  }, [id])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  // No telemóvel a ficha ocupa o ecrã e "Voltar à lista" regressa à lista; ao lado da lista não aparece.
  const voltar = (
    <button type="button" className="mesa-voltar" onClick={onLista}>
      Voltar à lista
    </button>
  )

  if (erro || dados === null) {
    return (
      <FichaCartao>
        {voltar}
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este pedido não existe.'}
        </p>
      </FichaCartao>
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
      {voltar}
      <FichaCartao sobretitulo={`Pedido de adesão · ${manual ? 'criado à mão' : 'Tally'}`} nome={pedido.nome_completo}>
        <div className="mesa-ficha-estado">
          <Pilula estado={pedido.estado}>{rotulo(ESTADOS_PEDIDO, pedido.estado)}</Pilula>
        </div>

        {aviso && (
          <p className="assoc-aviso" role="status">
            {aviso}
          </p>
        )}

        <Dados
          itens={[
            { rotulo: 'Nome nos emails', valor: pedido.nome_emails },
            { rotulo: 'Email', valor: <a href={`mailto:${pedido.email}`}>{pedido.email}</a> },
            { rotulo: 'Pedido', valor: formatDate(dataBruxelas(pedido.data_pedido)) },
            { rotulo: 'Aniversário', valor: pedido.aniversario ?? '—' },
            { rotulo: 'Primeiro contacto', valor: pedido.primeiro_contacto ?? '—' },
            { rotulo: 'Newsletter', valor: yesNo(pedido.newsletter) },
            { rotulo: 'Consentimento', valor: yesNo(pedido.consentimento) },
            {
              rotulo: 'Pagamento',
              valor:
                pedido.data_pagamento &&
                `${formatDate(pedido.data_pagamento)}${
                  nomePerfil(pedido.pagamento_confirmado_por) ? `, confirmado por ${nomePerfil(pedido.pagamento_confirmado_por)}` : ''
                }${pedido.data_pagamento <= FIM_FUNDADORES ? ' · fundador' : ''}`,
            },
            {
              rotulo: 'Contacto no Rede',
              valor: pedido.contacto ? (
                <Link to={`/admin?s=rede&c=${pedido.contacto.id}`}>{pedido.contacto.nome}</Link>
              ) : (
                'nenhum ligado (liga-se ao admitir)'
              ),
            },
            {
              rotulo: 'Associado',
              valor: associado && (
                <>
                  <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirAssociado(associado.id)}>
                    n.º {associado.numero}
                  </button>
                  {` · ${rotulo(TIPOS_ASSOCIADO, associado.tipo)}${associado.fundador ? ' · fundador' : ''}`}
                </>
              ),
            },
            {
              rotulo: 'Boas-vindas',
              valor:
                associado &&
                (boasVindas
                  ? `email ${associado.fundador ? '9' : '10'} enviado`
                  : `email ${associado.fundador ? '9' : '10'} por enviar: sai na passagem seguinte da função diária, às 9h`),
            },
          ]}
        />

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
        {aberto && !aEncerrar && (
          <Accoes
            saidas={
              <button type="button" className="mesa-saida" onClick={() => setAEncerrar(true)}>
                Encerrar o pedido
              </button>
            }
          />
        )}
        {aberto && aEncerrar && (
          <Saida
            pedido={pedido}
            onCancelar={() => setAEncerrar(false)}
            onFeito={() => {
              setAviso('Pedido encerrado.')
              setAEncerrar(false)
              recarregar()
            }}
          />
        )}
      </FichaCartao>

      <FichaCartao titulo="Emails">
        <Envios envios={envios} onMudou={recarregar} />
      </FichaCartao>
    </>
  )
}
