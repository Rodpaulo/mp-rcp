import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { dataBruxelas, euros } from '../../supabase/functions/_shared/campos.js'
import { listarEnviosDoAssociado, listarPerfis, listarRecibosDoAssociado, obterAssociado } from './api.js'
import Envios from './Envios.jsx'
import ReciboQuota from './ReciboQuota.jsx'
import { ESTADOS_ASSOCIADO, TIPOS_ASSOCIADO, nomeDoAssociado, rotulo } from './textos.js'
import Dados from '../admin/mesa/Dados.jsx'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'

export default function AssociadoFicha({ id, onLista, onAbrirPedido }) {
  const [dados, setDados] = useState(undefined)
  const [erro, setErro] = useState(false)

  const recarregar = useCallback(() => {
    return Promise.all([obterAssociado(id), listarEnviosDoAssociado(id), listarPerfis(), listarRecibosDoAssociado(id)]).then(
      ([associado, envios, perfis, recibos]) => setDados(associado ? { associado, envios, perfis, recibos } : null),
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

  const { associado: a, envios, perfis, recibos } = dados
  const quotas = [...a.quotas].sort((x, y) => y.ano - x.ano)
  const email = a.pedido?.email ?? a.contacto?.email
  const admitidoPor = perfis.find((p) => p.id === a.admitido_por)?.nome
  const semRecibo = quotas.filter((q) => q.estado === 'paga' && !q.recibo_numero).length

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

      <FichaCartao titulo="Quotas e recibos">
        {semRecibo > 0 && (
          <p className="assoc-aviso">
            {semRecibo === 1 ? 'Uma quota paga sem recibo.' : `${semRecibo} quotas pagas sem recibo.`}
          </p>
        )}
        {quotas.length === 0 ? (
          <p>Sem quotas registadas.</p>
        ) : (
          <ul className="assoc-quotas">
            {quotas.map((q) => (
              <li key={q.id}>
                <p className="assoc-quota-cabeca">
                  {q.ano} · {euros(q.valor)} · {q.estado === 'paga' ? `paga a ${formatDate(q.data_pagamento)}` : 'por pagar'}
                </p>
                {q.estado === 'paga' && (
                  <ReciboQuota
                    key={q.id}
                    quota={q}
                    associado={a}
                    recibos={recibos.filter((r) => r.quota_id === q.id)}
                    envios={envios}
                    onMudou={recarregar}
                  />
                )}
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
