import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LOAD_ERROR, SAVE_ERROR, formatDate } from '../admin/text.js'
import { dataBruxelas, euros } from '../../supabase/functions/_shared/campos.js'
import { listarEnviosDoAssociado, listarPerfis, obterAssociado, registarRecibo } from './api.js'
import Envios from './Envios.jsx'
import { ESTADOS_ASSOCIADO, TIPOS_ASSOCIADO, nomeDoAssociado, rotulo } from './textos.js'
import Dados from '../admin/mesa/Dados.jsx'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'

// "Registar recibo" numa quota paga: número e data (hoje por omissão).
function Recibo({ quota, onFeito }) {
  const hoje = dataBruxelas()
  const [aberto, setAberto] = useState(false)
  const [numero, setNumero] = useState(quota.recibo_numero ?? '')
  const [data, setData] = useState(quota.recibo_data ?? hoje)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  if (!aberto) {
    return (
      <button type="button" className="admin-button-secondary" onClick={() => setAberto(true)}>
        {quota.recibo_numero ? 'Corrigir recibo' : 'Registar recibo'}
      </button>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setAGravar(true)
    setErro('')
    try {
      await registarRecibo(quota.id, numero, data)
      onFeito()
    } catch (error) {
      console.error('registar recibo falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
    }
  }

  return (
    <form className="assoc-recibo" onSubmit={handleSubmit}>
      <label className="admin-field">
        <span>Número do recibo</span>
        <input required value={numero} onChange={(event) => setNumero(event.target.value)} />
      </label>
      <label className="admin-field">
        <span>Data do recibo</span>
        <input type="date" required max={hoje} value={data} onChange={(event) => setData(event.target.value)} />
      </label>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      <div className="assoc-accoes">
        <button type="submit" className="admin-button" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Gravar recibo'}
        </button>
        <button type="button" className="admin-button-secondary" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function AssociadoFicha({ id, onLista, onAbrirPedido }) {
  const [dados, setDados] = useState(undefined)
  const [erro, setErro] = useState(false)

  const recarregar = useCallback(() => {
    return Promise.all([obterAssociado(id), listarEnviosDoAssociado(id), listarPerfis()]).then(
      ([associado, envios, perfis]) => setDados(associado ? { associado, envios, perfis } : null),
      (error) => {
        console.error('carregar associado falhou:', error)
        setErro(true)
      },
    )
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
          {erro ? LOAD_ERROR : 'Este associado não existe.'}
        </p>
      </FichaCartao>
    )
  }
  if (dados === undefined) return <p>A carregar…</p>

  const { associado: a, envios, perfis } = dados
  const quotas = [...a.quotas].sort((x, y) => y.ano - x.ano)
  const email = a.pedido?.email ?? a.contacto?.email
  const admitidoPor = perfis.find((p) => p.id === a.admitido_por)?.nome

  return (
    <>
      {voltar}
      <FichaCartao
        sobretitulo={[`Associado n.º ${a.numero}`, rotulo(TIPOS_ASSOCIADO, a.tipo), a.fundador && 'fundador'].filter(Boolean).join(' · ')}
        nome={nomeDoAssociado(a)}
      >
        <div className="mesa-ficha-estado">
          <Pilula estado={a.estado}>{rotulo(ESTADOS_ASSOCIADO, a.estado)}</Pilula>
        </div>
        <Dados
          itens={[
            { rotulo: 'Tipo', valor: rotulo(TIPOS_ASSOCIADO, a.tipo) },
            { rotulo: 'Fundador', valor: a.fundador ? 'sim' : 'não' },
            { rotulo: 'Admissão', valor: `${formatDate(a.data_admissao)}${admitidoPor ? `, por ${admitidoPor}` : ''}` },
            { rotulo: 'Email', valor: email && <a href={`mailto:${email}`}>{email}</a> },
            { rotulo: 'Aniversário', valor: a.pedido?.aniversario },
            {
              rotulo: 'Contacto no Rede',
              valor: <Link to={`/admin?s=rede&c=${a.contacto_id}`}>{a.contacto?.nome}</Link>,
            },
            {
              rotulo: 'Pedido',
              valor: a.pedido && (
                <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirPedido(a.pedido.id)}>
                  {formatDate(dataBruxelas(a.pedido.data_pedido))}
                </button>
              ),
            },
          ]}
        />
      </FichaCartao>

      <FichaCartao titulo="Quotas">
        {quotas.length === 0 ? (
          <p>Sem quotas registadas.</p>
        ) : (
          <ul className="assoc-quotas">
            {quotas.map((q) => (
              <li key={q.id}>
                <p className="assoc-quota-cabeca">
                  {q.ano} · {euros(q.valor)} · {q.estado === 'paga' ? `paga a ${formatDate(q.data_pagamento)}` : 'por pagar'}
                </p>
                <p className="assoc-linha-detalhe">
                  {q.recibo_numero
                    ? `Recibo n.º ${q.recibo_numero}${q.recibo_data ? `, de ${formatDate(q.recibo_data)}` : ''}`
                    : 'Sem recibo registado'}
                </p>
                {q.estado === 'paga' && <Recibo key={`${q.id}-${q.recibo_numero}`} quota={q} onFeito={recarregar} />}
              </li>
            ))}
          </ul>
        )}
      </FichaCartao>

      <FichaCartao titulo="Emails">
        <Envios envios={envios} onMudou={recarregar} />
      </FichaCartao>
    </>
  )
}
