// Leitura das encomendas de um evento no pretix (SPEC §18.3 e §18.4). Sem importações: corre na
// Edge Function (Deno) e pode ser experimentado fora dela com um fetch simulado.
//
// API: GET https://pretix.eu/api/v1/organizers/{organizador}/events/{evento}/orders/
//   cabeçalho Authorization: Token <token>; 50 encomendas por página; o endereço da página seguinte
//   vem em `next`. 401: chave recusada. 403: o evento não existe ou a chave não tem acesso (o pretix
//   não distingue). 429: demasiados pedidos.
// Pedem-se só os campos precisos (include): o resto dos dados das encomendas nem sai do pretix.

export const API = 'https://pretix.eu/api/v1/'
export const MAXIMO_PAGINAS = 40
export const TEMPO_MAXIMO_MS = 15000

const CAMPOS = ['status', 'email', 'testmode', 'positions.attendee_name']

// Um erro com o código do caso (para os textos do ecrã) e o estado HTTP do pretix (para os registos).
// Nunca leva dados pessoais nem o token.
export class ErroPretix extends Error {
  constructor(codigo, estadoHttp = null) {
    super(codigo)
    this.codigo = codigo
    this.estadoHttp = estadoHttp
  }
}

export function enderecoInicial(organizador, evento) {
  const url = new URL(
    `organizers/${encodeURIComponent(organizador)}/events/${encodeURIComponent(evento)}/orders/`,
    API,
  )
  url.searchParams.set('testmode', 'false')
  for (const campo of CAMPOS) url.searchParams.append('include', campo)
  return url.toString()
}

async function pedirPagina(endereco, token, fetchFn) {
  let r
  try {
    r = await fetchFn(endereco, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    })
  } catch {
    throw new ErroPretix('pretix_indisponivel') // sem resposta a tempo, ou sem rede
  }
  if (r.status === 401) throw new ErroPretix('chave_recusada', 401)
  if (r.status === 403 || r.status === 404) throw new ErroPretix('evento_nao_encontrado', r.status)
  if (r.status === 429 || r.status >= 500) throw new ErroPretix('pretix_indisponivel', r.status)
  if (!r.ok) throw new ErroPretix('resposta_inesperada', r.status)

  let corpo
  try {
    corpo = await r.json()
  } catch {
    throw new ErroPretix('resposta_inesperada', r.status)
  }
  if (!corpo || !Array.isArray(corpo.results)) throw new ErroPretix('resposta_inesperada', r.status)
  for (const encomenda of corpo.results) {
    if (typeof encomenda?.status !== 'string') throw new ErroPretix('resposta_inesperada', r.status)
  }
  return corpo
}

// Todas as encomendas do evento, fora do modo de teste. Ou vêm todas, ou erro: nunca metade.
export async function lerEncomendas({ organizador, evento, token, fetchFn = fetch }) {
  const encomendas = []
  let endereco = enderecoInicial(organizador, evento)
  for (let pagina = 1; endereco; pagina++) {
    if (pagina > MAXIMO_PAGINAS) throw new ErroPretix('demasiadas_encomendas')
    // O token só vai para o pretix: um `next` que aponte para outro lado é recusado.
    if (!endereco.startsWith(API)) throw new ErroPretix('resposta_inesperada')
    const corpo = await pedirPagina(endereco, token, fetchFn)
    encomendas.push(...corpo.results)
    endereco = corpo.next || null
  }
  return encomendas
}

// Separa as encomendas em inscritos ({email, nome}) e cancelados (emails) — SPEC §18.3.
// Pagas (p): inscritas. Canceladas (c): canceladas. Pendentes (n), expiradas (e) e de teste: fora.
// Uma encomenda é uma pessoa. Um email com uma encomenda paga e outra cancelada fica inscrito.
// Emails em falta seguem tal como vêm: a função da base conta-os como inválidos.
export function separar(encomendas) {
  const inscritos = new Map()
  const semEmail = []
  const cancelados = new Set()

  for (const encomenda of encomendas) {
    if (encomenda.testmode === true) continue
    const email = typeof encomenda.email === 'string' ? encomenda.email.trim().toLowerCase() : ''
    if (encomenda.status === 'p') {
      if (!email) {
        semEmail.push({ email: null })
        continue
      }
      const nome = primeiroNome(encomenda)
      const anterior = inscritos.get(email)
      if (!anterior) inscritos.set(email, { email, nome })
      else if (!anterior.nome && nome) anterior.nome = nome
    } else if (encomenda.status === 'c' && email) {
      cancelados.add(email)
    }
  }
  for (const email of inscritos.keys()) cancelados.delete(email)

  return { inscritos: [...inscritos.values(), ...semEmail], cancelados: [...cancelados] }
}

function primeiroNome(encomenda) {
  const posicao = Array.isArray(encomenda.positions) ? encomenda.positions[0] : null
  const nome = typeof posicao?.attendee_name === 'string' ? posicao.attendee_name.trim() : ''
  return nome || null
}
