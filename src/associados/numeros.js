// Números da barra do separador Associados (SPEC 17.3), com as leituras que o módulo já faz.

import { ESTADOS_ABERTOS, listarAssociados, listarPedidos, listarUltimosEnvios } from './api.js'

// Entre os últimos 100 envios: os falhados ou presos sem envio bem-sucedido posterior do mesmo
// email-tipo, ao mesmo pedido ou associado, no mesmo período. Cada email conta uma vez.
export function emailsQueNaoSairam(envios) {
  const chave = (e) => `${e.email_tipo}|${e.pedido_id ?? ''}|${e.associado_id ?? ''}|${e.periodo}`
  const ultimoEnviado = new Map()
  for (const e of envios) {
    if (e.estado !== 'enviado') continue
    const k = chave(e)
    if (!ultimoEnviado.has(k) || ultimoEnviado.get(k) < e.enviado_em) ultimoEnviado.set(k, e.enviado_em)
  }
  const porResolver = new Set()
  for (const e of envios) {
    if (e.estado === 'enviado') continue
    const enviado = ultimoEnviado.get(chave(e))
    if (!enviado || enviado < e.enviado_em) porResolver.add(chave(e))
  }
  return porResolver.size
}

export async function lerNumerosAssociados() {
  const [pedidos, associados, envios] = await Promise.all([listarPedidos(), listarAssociados(), listarUltimosEnvios()])
  return [
    { rotulo: 'Pedidos em aberto', numero: pedidos.filter((p) => ESTADOS_ABERTOS.includes(p.estado)).length },
    { rotulo: 'Pagos por admitir', numero: pedidos.filter((p) => p.estado === 'pago').length },
    { rotulo: 'Associados', numero: associados.filter((a) => a.estado === 'activo').length },
    { rotulo: 'Emails que não saíram', numero: emailsQueNaoSairam(envios), pedeAccao: true },
  ]
}
