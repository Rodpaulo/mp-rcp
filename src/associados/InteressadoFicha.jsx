import { useCallback, useEffect, useState } from 'react'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { dataBruxelas, diasEntre } from '../../supabase/functions/_shared/campos.js'
import { lerConfiguracao, listarEnviosDaPessoa, listarInteressados } from './api.js'
import Envios from './Envios.jsx'
import { DIAS_ATE_EMAIL_3, ESTADOS_PEDIDO, etapaInteressado, nomeDoInteressado, rotulo } from './textos.js'
import Dados from '../admin/mesa/Dados.jsx'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'

const dia = (instante) => formatDate(dataBruxelas(instante))

// '2026-11-06' + n dias, em 'AAAA-MM-DD'.
function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Uma linha do funil para o email 2 (o envio que conta, a configuração e o dia do interesse).
function linhaEmail2(i, contaPronta, hoje) {
  const e = i.email2
  if (e?.estado === 'enviado') return `enviado a ${dia(e.enviado_em)}`
  if (e?.estado === 'a_enviar') return `a enviar desde ${dia(e.enviado_em)}`
  if (i.pedido) return 'não sai: já há pedido'
  const motivo = !contaPronta
    ? 'falta o IBAN e o titular da conta na configuração'
    : dataBruxelas(i.associado_interesse_at) >= hoje
      ? 'sai a partir de amanhã, às 9h'
      : 'sai na passagem seguinte da função diária, às 9h'
  return e?.estado === 'falhou' ? `falhou a ${dia(e.enviado_em)}; ${motivo}` : `por enviar (${motivo})`
}

function linhaEmail3(i) {
  const e = i.email3
  if (e?.estado === 'enviado') return `enviado a ${dia(e.enviado_em)}`
  if (e?.estado === 'a_enviar') return `a enviar desde ${dia(e.enviado_em)}`
  if (i.pedido) return 'não sai: já há pedido'
  if (i.email2?.estado !== 'enviado') return 'depois do email 2'
  const previsto = somarDias(dataBruxelas(i.email2.enviado_em), DIAS_ATE_EMAIL_3)
  return e?.estado === 'falhou' ? `falhou a ${dia(e.enviado_em)}; volta a tentar às 9h` : `previsto para ${formatDate(previsto)}`
}

// Ficha de um interessado (SPEC 16.16): o funil e os emails. people só se lê.
export default function InteressadoFicha({ id, onLista, onAbrirPedido }) {
  const [dados, setDados] = useState(undefined)
  const [erro, setErro] = useState(false)

  const recarregar = useCallback(() => {
    return Promise.all([listarInteressados(), listarEnviosDaPessoa(id), lerConfiguracao()]).then(
      ([pessoas, envios, config]) => {
        const pessoa = pessoas.find((p) => p.id === id)
        setDados(pessoa ? { pessoa, envios, contaPronta: Boolean(config.iban && config.titular_conta) } : null)
      },
      (error) => {
        console.error('carregar interessado falhou:', error)
        setErro(true)
      },
    )
  }, [id])

  useEffect(() => {
    recarregar()
  }, [recarregar])

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
          {erro ? LOAD_ERROR : 'Este interessado não existe.'}
        </p>
      </FichaCartao>
    )
  }
  if (dados === undefined) return <p>A carregar…</p>

  const { pessoa: i, envios, contaPronta } = dados
  const hoje = dataBruxelas()
  const etapa = etapaInteressado(i)
  const diasDesde = diasEntre(dataBruxelas(i.associado_interesse_at), hoje)

  return (
    <>
      {voltar}
      <FichaCartao sobretitulo={i.name?.trim() ? 'Interessado' : 'Interessado · sem nome'} nome={nomeDoInteressado(i)}>
        <div className="mesa-ficha-estado">
          <Pilula estado={etapa.estado}>{etapa.rotulo}</Pilula>
        </div>
        <Dados
          itens={[
            { rotulo: 'Email', valor: <a href={`mailto:${i.email}`}>{i.email}</a> },
            {
              rotulo: 'Nome',
              valor: i.name?.trim() || 'sem nome: os emails usam a parte do email antes do @',
            },
          ]}
        />
      </FichaCartao>

      <FichaCartao titulo="Funil">
        <ul className="assoc-funil">
          <li>
            Interesse registado a {dia(i.associado_interesse_at)}
            {diasDesde > 0 && ` (há ${diasDesde} ${diasDesde === 1 ? 'dia' : 'dias'})`}
          </li>
          <li>Email 2: {linhaEmail2(i, contaPronta, hoje)}</li>
          <li>Email 3: {linhaEmail3(i)}</li>
          <li>
            {i.pedido ? (
              <>
                Pedido recebido a{' '}
                <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirPedido(i.pedido.id)}>
                  {dia(i.pedido.data_pedido)}
                </button>{' '}
                ({rotulo(ESTADOS_PEDIDO, i.pedido.estado)})
              </>
            ) : (
              'Ainda sem pedido de adesão'
            )}
          </li>
        </ul>
      </FichaCartao>

      <FichaCartao titulo="Emails">
        <Envios envios={envios} onMudou={recarregar} />
      </FichaCartao>
    </>
  )
}
