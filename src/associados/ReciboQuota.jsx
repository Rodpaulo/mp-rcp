import { useEffect, useState } from 'react'
import { SAVE_ERROR, formatDate } from '../admin/text.js'
import { camposAssociado, dataBruxelas, euros, preencher } from '../../supabase/functions/_shared/campos.js'
import {
  anularRecibo,
  descarregarRecibo,
  emitirRecibo,
  lerConfiguracao,
  obterEmailTipo,
  previsualizarRecibo,
  reenviarRecibo,
  registarRecibo,
} from './api.js'
import Pilula from '../admin/mesa/Pilula.jsx'
import { ESTADOS_ENVIO, numeroEmail, rotulo } from './textos.js'
import { descarregar } from './zip.js'

const mensagem = (error) => (error?.aviso || error?.code === 'P0001' ? error.message : SAVE_ERROR)

// Email 11 na primeira quota do associado (a da adesão), 18 nas renovações (como a função).
function emailDoRecibo(associado, quota) {
  const primeiro = Math.min(...associado.quotas.map((q) => q.ano))
  return quota.ano === primeiro ? '11_recibo_adesao' : '18_quota_paga_recibo'
}

function resultadoEnvio(envio) {
  if (!envio) return ''
  if (envio.resultado === 'enviado') return `Email ${numeroEmail(envio.email)} enviado com o PDF.`
  if (envio.resultado === 'inactivo') return `O email ${numeroEmail(envio.email)} está desactivado: o recibo não seguiu por email.`
  return `O email ${numeroEmail(envio.email)} não saiu (${envio.motivo ?? 'erro'}). A passagem diária tenta de novo às 9h, com o mesmo PDF.`
}

// "Emitir recibo": primeiro a pré-visualização do PDF e do email; depois "Emitir e enviar".
function Emissao({ quota, associado, onCancelar, onFeito }) {
  const [pdf, setPdf] = useState(null) // URL do Blob
  const [email, setEmail] = useState(null) // { chave, assunto, corpo, emFalta }
  const [erro, setErro] = useState('')
  const [aEmitir, setAEmitir] = useState(false)

  useEffect(() => {
    let url = null
    let activo = true
    const hoje = dataBruxelas()
    const chave = emailDoRecibo(associado, quota)
    Promise.all([previsualizarRecibo(quota.id), obterEmailTipo(chave), lerConfiguracao()]).then(
      ([blob, tipo, config]) => {
        if (!activo) return
        url = URL.createObjectURL(blob)
        setPdf(url)
        const campos = camposAssociado(associado, config, hoje, { ...quota, recibo_numero: 'AAAA-NNN' })
        const assunto = preencher(tipo.assunto, campos, hoje)
        const corpo = preencher(tipo.corpo, campos, hoje)
        setEmail({
          chave,
          activo: tipo.activo,
          assunto: assunto.texto,
          corpo: corpo.texto,
          emFalta: [...new Set([...assunto.emFalta, ...corpo.emFalta])],
        })
      },
      (error) => {
        console.error('pré-visualizar recibo falhou:', error)
        if (activo) setErro(mensagem(error))
      },
    )
    return () => {
      activo = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [quota, associado])

  async function emitir() {
    setAEmitir(true)
    setErro('')
    try {
      const r = await emitirRecibo(quota.id)
      onFeito(`Recibo n.º ${r.recibo.numero} emitido. ${resultadoEnvio(r.envio)}`)
    } catch (error) {
      console.error('emitir recibo falhou:', error)
      setErro(mensagem(error))
      setAEmitir(false)
    }
  }

  return (
    <div className="assoc-emissao">
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      {!pdf && !erro && <p>A preparar a pré-visualização…</p>}
      {pdf && (
        <iframe className="assoc-pdf" src={pdf} title={`Pré-visualização do recibo da quota de ${quota.ano}`} />
      )}
      {email && (
        <>
          <p className="assoc-nota">
            Segue com o email {numeroEmail(email.chave)} e o PDF em anexo. O número é atribuído ao emitir.
          </p>
          {!email.activo && <p className="assoc-aviso">Este email-tipo está desactivado: o recibo emite-se, mas não segue por email.</p>}
          {email.emFalta.length > 0 && (
            <p className="assoc-aviso" role="status">
              Por preencher: {email.emFalta.map((n) => `{${n}}`).join(', ')}. O recibo emite-se na mesma; o email só sai
              quando estiverem preenchidos.
            </p>
          )}
          <div className="assoc-previsualizacao">
            <p className="assoc-previsualizacao-assunto">{email.assunto}</p>
            <p className="assoc-texto">{email.corpo}</p>
          </div>
        </>
      )}
      <div className="assoc-accoes">
        <button type="button" className="mesa-botao" disabled={!pdf || aEmitir} onClick={emitir}>
          {aEmitir ? 'Um momento…' : 'Emitir e enviar'}
        </button>
        <button type="button" className="mesa-botao-discreto" disabled={aEmitir} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// "Recibo emitido fora da app" (o antigo "Registar recibo"): só para casos excepcionais.
function ReciboFora({ quota, onFeito, onCancelar }) {
  const hoje = dataBruxelas()
  const [numero, setNumero] = useState(quota.recibo_numero ?? '')
  const [data, setData] = useState(quota.recibo_data ?? hoje)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setAGravar(true)
    setErro('')
    try {
      await registarRecibo(quota.id, numero, data)
      onFeito('')
    } catch (error) {
      console.error('registar recibo fora da app falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
    }
  }

  return (
    <form className="assoc-recibo" onSubmit={handleSubmit}>
      <p className="assoc-nota">Só para um recibo feito fora da app. Fica registado o número e a data; não há PDF nem email.</p>
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
        <button type="submit" className="mesa-botao-secundario" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Gravar recibo'}
        </button>
        <button type="button" className="mesa-botao-discreto" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// "Anular": nota obrigatória e confirmação.
function Anulacao({ recibo, onFeito, onCancelar }) {
  const [nota, setNota] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!window.confirm(`Anular o recibo n.º ${recibo.numero}? Fica anulado para sempre; depois podes emitir outro.`)) return
    setAGravar(true)
    setErro('')
    try {
      await anularRecibo(recibo.id, nota)
      onFeito(`Recibo n.º ${recibo.numero} anulado. Podes emitir outro.`)
    } catch (error) {
      console.error('anular recibo falhou:', error)
      setErro(mensagem(error))
      setAGravar(false)
    }
  }

  return (
    <form className="assoc-recibo" onSubmit={handleSubmit}>
      <label className="admin-field">
        <span>Porque é que o recibo n.º {recibo.numero} se anula</span>
        <textarea required rows={2} value={nota} onChange={(event) => setNota(event.target.value)} />
      </label>
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
      <div className="assoc-accoes">
        <button type="submit" className="mesa-botao" disabled={aGravar || !nota.trim()}>
          {aGravar ? 'Um momento…' : 'Anular recibo'}
        </button>
        <button type="button" className="mesa-botao-discreto" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// O recibo de uma quota paga, na ficha do associado (SPEC 16.17).
// recibos: os desta quota (emitido e anulados); envios: os emails destes recibos.
export default function ReciboQuota({ quota, associado, recibos, envios, onMudou }) {
  const [modo, setModo] = useState('') // '' | 'emitir' | 'fora' | 'anular'
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState('')

  const emitido = recibos.find((r) => r.estado === 'emitido')
  const anulados = recibos.filter((r) => r.estado === 'anulado')
  const foraDaApp = !emitido && quota.recibo_numero
  const enviosDoEmitido = emitido ? envios.filter((e) => e.recibo_id === emitido.id) : []
  const ultimoEnvio = enviosDoEmitido[0] // vêm do mais recente para o mais antigo

  function feito(texto) {
    setModo('')
    setAviso(texto)
    onMudou()
  }

  async function accao(nome, fazer) {
    setOcupado(nome)
    setErro('')
    setAviso('')
    try {
      await fazer()
    } catch (error) {
      console.error(`${nome} falhou:`, error)
      setErro(mensagem(error))
    } finally {
      setOcupado('')
    }
  }

  const baixar = () =>
    accao('descarregar', async () => descarregar(await descarregarRecibo(emitido.ficheiro), `Recibo ${emitido.numero}.pdf`))
  const reenviar = () =>
    accao('reenviar', async () => {
      const r = await reenviarRecibo(emitido.id)
      feito(resultadoEnvio(r.envio))
    })
  const concluir = () =>
    accao('concluir', async () => {
      const r = await emitirRecibo(quota.id)
      feito(`Recibo n.º ${r.recibo.numero} concluído. ${resultadoEnvio(r.envio)}`)
    })

  return (
    <div className="assoc-recibo-quota">
      {emitido && (
        <>
          <p className="assoc-linha-detalhe">
            Recibo n.º <strong>{emitido.numero}</strong>, de {formatDate(emitido.data)}, {euros(emitido.valor)}
            {ultimoEnvio && (
              <>
                {' · '}
                <Pilula estado={ultimoEnvio.estado}>{rotulo(ESTADOS_ENVIO, ultimoEnvio.estado)}</Pilula> email{' '}
                {numeroEmail(ultimoEnvio.email_tipo)} para {ultimoEnvio.destinatario}
              </>
            )}
          </p>
          {!emitido.ficheiro && (
            <p className="assoc-aviso">Este recibo ficou sem PDF. "Concluir recibo" gera-o com o mesmo número e envia-o.</p>
          )}
          {modo === 'anular' ? (
            <Anulacao recibo={emitido} onFeito={feito} onCancelar={() => setModo('')} />
          ) : (
            <div className="mesa-accoes">
              <div className="mesa-accoes-principais">
                {emitido.ficheiro ? (
                  <>
                    <button type="button" className="mesa-botao-secundario" disabled={!!ocupado} onClick={baixar}>
                      {ocupado === 'descarregar' ? 'Um momento…' : 'Descarregar'}
                    </button>
                    <button type="button" className="mesa-botao-secundario" disabled={!!ocupado} onClick={reenviar}>
                      {ocupado === 'reenviar' ? 'Um momento…' : 'Reenviar'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="mesa-botao" disabled={!!ocupado} onClick={concluir}>
                    {ocupado === 'concluir' ? 'Um momento…' : 'Concluir recibo'}
                  </button>
                )}
              </div>
              <div className="mesa-accoes-saidas">
                <button type="button" className="mesa-saida" disabled={!!ocupado} onClick={() => setModo('anular')}>
                  Anular
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {foraDaApp && (
        <p className="assoc-linha-detalhe">
          Recibo n.º {quota.recibo_numero}
          {quota.recibo_data ? `, de ${formatDate(quota.recibo_data)}` : ''}, emitido fora da app.
        </p>
      )}

      {!emitido && !foraDaApp && modo !== 'emitir' && <p className="assoc-linha-detalhe">Sem recibo.</p>}

      {!emitido && modo === 'emitir' && (
        <Emissao quota={quota} associado={associado} onCancelar={() => setModo('')} onFeito={feito} />
      )}
      {!emitido && modo === 'fora' && <ReciboFora quota={quota} onFeito={feito} onCancelar={() => setModo('')} />}

      {!emitido && !modo && (
        <>
          {!foraDaApp && (
            <div className="assoc-accoes">
              <button type="button" className="mesa-botao" onClick={() => setModo('emitir')}>
                Emitir recibo
              </button>
            </div>
          )}
          <p className="assoc-recibo-fora">
            <button type="button" className="assoc-ligacao-texto" onClick={() => setModo('fora')}>
              {foraDaApp ? 'Corrigir o recibo emitido fora da app' : 'Recibo emitido fora da app'}
            </button>
          </p>
        </>
      )}

      {anulados.map((r) => (
        <p key={r.id} className="assoc-linha-detalhe assoc-recibo-anulado">
          <s>Recibo n.º {r.numero}</s>, de {formatDate(r.data)}: anulado a {formatDate(dataBruxelas(r.anulado_em))}
          {r.nota ? ` · ${r.nota}` : ''}
        </p>
      ))}

      {aviso && (
        <p className="assoc-nota" role="status">
          {aviso}
        </p>
      )}
      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
