// Recibos das quotas (SPEC §16.17): o que a função emitir-recibo e a passagem diária partilham.
// Ler o associado e as quotas, escolher o email (11 ou 18), descarregar o PDF do Storage e
// enviá-lo em anexo, registado em emails_enviados com o recibo.

import { camposAssociado, enviarEmail } from './emails.js'

export const BUCKET = 'recibos'

const CAMPOS_ASSOCIADO = `id, numero, estado,
  contacto:contactos!associados_contacto_id_fkey(nome, email),
  pedido:pedidos_adesao!associados_pedido_id_fkey(nome_completo, nome_emails, email, aniversario, data_pedido),
  quotas(id, ano, valor, estado)`

export async function lerAssociado(sb, associadoId) {
  const { data, error } = await sb.from('associados').select(CAMPOS_ASSOCIADO).eq('id', associadoId).maybeSingle()
  if (error) throw new Error(`associados: ${error.message}`)
  return data
}

// Nome que vai no recibo: o nome completo do pedido e, sem pedido, o do contacto.
export function nomeNoRecibo(associado) {
  return associado.pedido?.nome_completo?.trim() || associado.contacto?.nome?.trim() || null
}

// Caminho do PDF no bucket: 'AAAA/AAAA-NNN.pdf'.
export function caminhoDoRecibo(recibo) {
  return `${recibo.ano}/${recibo.numero}.pdf`
}

// Email 11 para a primeira quota do associado (a da adesão); 18 para as renovações.
export function emailDoRecibo(associado, quota) {
  const primeiro = Math.min(...associado.quotas.map((q) => q.ano))
  return quota.ano === primeiro ? '11_recibo_adesao' : '18_quota_paga_recibo'
}

export function base64(bytes) {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

export async function descarregarPdf(sb, caminho) {
  const { data, error } = await sb.storage.from(BUCKET).download(caminho)
  if (error) throw new Error(`Storage ${caminho}: ${error.message}`)
  return new Uint8Array(await data.arrayBuffer())
}

// Envia o email 11 ou 18 com o PDF em anexo. Cada chamada é um envio novo (um reenvio também);
// a base só impede dois envios do mesmo recibo ao mesmo tempo.
export async function enviarRecibo(sb, { recibo, associado, pdf, config, tipos, hoje }) {
  const quota = associado.quotas.find((q) => q.id === recibo.quota_id)
  if (!quota) throw new Error(`A quota do recibo ${recibo.numero} não está no associado.`)
  const chave = emailDoRecibo(associado, quota)
  const campos = camposAssociado(associado, config, hoje, { ...quota, valor: recibo.valor, recibo_numero: recibo.numero })
  const r = await enviarEmail(sb, {
    tipo: tipos[chave],
    associadoId: associado.id,
    reciboId: recibo.id,
    para: campos.email,
    campos,
    hoje,
    anexos: [{ filename: `Recibo ${recibo.numero}.pdf`, content: base64(pdf) }],
  })
  return { ...r, email: chave }
}
