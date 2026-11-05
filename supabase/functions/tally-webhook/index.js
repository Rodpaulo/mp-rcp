// tally-webhook — recebe cada submissão do "Pedido de adesão" no Tally (SPEC §16.3, §16.4).
// 1. Valida a assinatura do Tally (TALLY_SIGNING_SECRET).
// 2. Lê os campos pelos títulos do formulário.
// 3. Cria o pedido (um tally_id repetido é ignorado; um email com pedido em
//    aberto fica nas notas desse pedido).
// 4. Cria ou liga o contacto do Rede.
// 5. Envia o email 4 e regista-o. Se o Resend falhar, o pedido fica criado e
//    o email sai na passagem seguinte da função diária.

import {
  camposPedido, clienteServico, dataBruxelas, enviarEmail, iguais, json, lerConfiguracao, lerEmailsTipo,
} from '../_shared/emails.js'

const ESTADOS_ABERTOS = ['recebido', 'instrucoes_enviadas', 'pago']
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'Só POST.' })

  const segredo = Deno.env.get('TALLY_SIGNING_SECRET')
  if (!segredo) return json(500, { erro: 'TALLY_SIGNING_SECRET não está definido.' })

  const bruto = await req.text()
  const assinatura = req.headers.get('tally-signature')
  if (!assinatura || !iguais(assinatura, await assinar(bruto, segredo))) {
    return json(401, { erro: 'Assinatura inválida.' })
  }

  let evento
  try {
    evento = JSON.parse(bruto)
  } catch {
    return json(400, { erro: 'JSON inválido.' })
  }
  if (evento?.eventType !== 'FORM_RESPONSE') return json(200, { resultado: 'ignorado', motivo: evento?.eventType })

  const dados = evento.data ?? {}
  const tallyId = dados.responseId ?? dados.submissionId ?? evento.eventId
  const f = lerCampos(dados.fields ?? [])
  const email = (f.email ?? '').trim().toLowerCase()
  if (!tallyId || !f.nome_completo || !f.nome_emails || !EMAIL_VALIDO.test(email)) {
    // Sem os campos obrigatórios não há pedido. O Tally guarda a resposta na folha.
    console.error('Pedido sem campos obrigatórios', tallyId, Object.keys(f))
    return json(200, { resultado: 'ignorado', motivo: 'campos obrigatórios em falta' })
  }

  const sb = clienteServico()

  // Repetição do mesmo envio do Tally.
  const { data: repetido, error: erroRep } = await sb.from('pedidos_adesao').select('id').eq('tally_id', tallyId).maybeSingle()
  if (erroRep) return json(500, { erro: erroRep.message })
  if (repetido) return json(200, { resultado: 'repetido', pedido: repetido.id })

  const dataPedido = dados.createdAt ?? evento.createdAt ?? new Date().toISOString()
  const aniv = normalizarAniversario(f.aniversario)
  const notas = []
  if (aniv.invalido) notas.push(`Aniversário não reconhecido no Tally: «${aniv.invalido}».`)

  // Segundo pedido com o email de um pedido em aberto: só uma nota (SPEC 16.5).
  const { data: aberto, error: erroAb } = await sb.from('pedidos_adesao').select('id, notas')
    .eq('email', email).in('estado', ESTADOS_ABERTOS).order('data_pedido').limit(1).maybeSingle()
  if (erroAb) return json(500, { erro: erroAb.message })
  if (aberto) {
    if (!(aberto.notas ?? '').includes(tallyId)) {
      const linha = `Novo pedido no Tally a ${dataBruxelas(dataPedido)} (tally_id ${tallyId}); não foi criado pedido novo.`
      const { error } = await sb.from('pedidos_adesao').update({
        notas: aberto.notas ? `${aberto.notas}\n${linha}` : linha,
        updated_at: new Date().toISOString(),
      }).eq('id', aberto.id)
      if (error) return json(500, { erro: error.message })
    }
    return json(200, { resultado: 'pedido_em_aberto', pedido: aberto.id })
  }

  const { data: pedido, error: erroIns } = await sb.from('pedidos_adesao').insert({
    tally_id: tallyId,
    data_pedido: dataPedido,
    nome_completo: f.nome_completo,
    nome_emails: f.nome_emails,
    email,
    aniversario: aniv.valor,
    primeiro_contacto: f.primeiro_contacto || null,
    newsletter: f.newsletter === true,
    consentimento: f.consentimento === true,
    notas: notas.length ? notas.join('\n') : null,
  }).select('*').single()
  if (erroIns) {
    if (erroIns.code === '23505') return json(200, { resultado: 'repetido' })
    return json(500, { erro: erroIns.message })
  }

  // Contacto do Rede: um erro aqui não desfaz o pedido.
  try {
    await ligarContacto(sb, pedido)
  } catch (e) {
    console.error('Contacto', pedido.id, e?.message ?? e)
  }

  // Email 4: um erro aqui não desfaz o pedido; a função diária volta a tentar.
  let email4 = { resultado: 'falhou' }
  try {
    const hoje = dataBruxelas()
    const [config, tipos] = await Promise.all([lerConfiguracao(sb), lerEmailsTipo(sb)])
    email4 = await enviarEmail(sb, {
      tipo: tipos['04_pedido_recebido'],
      pedidoId: pedido.id,
      para: pedido.email,
      campos: camposPedido(pedido, config, hoje),
      hoje,
    })
    if (email4.resultado === 'enviado') {
      await sb.from('pedidos_adesao')
        .update({ estado: 'instrucoes_enviadas', updated_at: new Date().toISOString() })
        .eq('id', pedido.id).eq('estado', 'recebido')
    }
  } catch (e) {
    console.error('Email 4', pedido.id, e?.message ?? e)
  }

  return json(200, { resultado: 'criado', pedido: pedido.id, email4: email4.resultado, motivo: email4.motivo })
})

// ---------- Assinatura -----------------------------------------------
// Tally-Signature = base64(HMAC-SHA256(corpo em bruto, segredo de assinatura)).

async function assinar(corpo, segredo) {
  const chave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
  return btoa(String.fromCharCode(...mac))
}

// ---------- Campos do formulário -------------------------------------

function normalizarTitulo(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[\s?:*.!]+$/, '')
}

// Títulos do formulário (SPEC 16.4). "exacto": o título tem de ser este;
// senão, basta começar assim. Fica o primeiro campo que corresponder.
const MAPA = [
  { coluna: 'nome_completo', titulo: 'nome completo', exacto: true },
  { coluna: 'nome_emails', titulo: 'nome a usar nos emails', exacto: true },
  { coluna: 'email', titulo: 'email', exacto: true },
  { coluna: 'aniversario', titulo: 'dia de aniversario', exacto: false },
  { coluna: 'primeiro_contacto', titulo: 'primeiro contacto', exacto: false },
  { coluna: 'consentimento', titulo: 'consentimento', exacto: true, booleano: true },
  { coluna: 'newsletter', titulo: 'newsletter', exacto: true, booleano: true },
]

function lerCampos(campos) {
  const r = {}
  for (const m of MAPA) {
    const campo = campos.find((c) => {
      const t = normalizarTitulo(c.label)
      return m.exacto ? t === m.titulo : t.startsWith(m.titulo)
    })
    if (!campo) continue
    r[m.coluna] = m.booleano ? valorBooleano(campo) : valorTexto(campo)
  }
  return r
}

// Escolhas (MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN) vêm como ids das opções.
function valorTexto(campo) {
  const v = campo.value
  if (v === null || v === undefined) return null
  if (Array.isArray(v)) {
    const opcoes = campo.options ?? []
    const textos = v.map((id) => opcoes.find((o) => o.id === id)?.text ?? String(id))
    return textos.join(', ').trim() || null
  }
  return String(v).trim() || null
}

function valorBooleano(campo) {
  const v = campo.value
  if (typeof v === 'boolean') return v
  if (Array.isArray(v)) {
    if (!v.length) return false
    const texto = valorTexto(campo) ?? ''
    return !/^n(ã|a)o\b/i.test(texto)
  }
  const t = String(v ?? '').trim()
  if (!t) return false
  return !/^(n(ã|a)o|false|0)$/i.test(t)
}

// Aniversário → 'dd/mm'. Aceita "5/3", "05/03", "05-03", "5.3", "5 3" e datas
// completas ("1980-03-05", "05/03/1980"). O que não se perceber fica nas notas.
function normalizarAniversario(bruto) {
  const t = String(bruto ?? '').trim()
  if (!t) return { valor: null }
  let d
  let m
  let x = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (x) {
    d = Number(x[3]); m = Number(x[2])
  } else if ((x = t.match(/^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})(?:\s*[/.\-\s]\s*\d{2,4})?$/))) {
    d = Number(x[1]); m = Number(x[2])
  } else {
    return { valor: null, invalido: t }
  }
  const diasNoMes = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m < 1 || m > 12 || d < 1 || d > diasNoMes[m - 1]) return { valor: null, invalido: t }
  return { valor: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` }
}

// ---------- Contacto do Rede -----------------------------------------
// Como a vista "Interessados" (SPEC 14.3): etiqueta 'associado' e pedido_adesao_em.

async function ligarContacto(sb, pedido) {
  const dia = dataBruxelas(pedido.data_pedido)
  const agora = new Date().toISOString()

  const { data: existente, error: erroLer } = await sb.from('contactos')
    .select('id, etiquetas, pedido_adesao_em')
    .eq('tipo_registo', 'pessoa').eq('email', pedido.email)
    .order('created_at').limit(1).maybeSingle()
  if (erroLer) throw new Error(erroLer.message)

  let contactoId
  if (existente) {
    contactoId = existente.id
    const etiquetas = existente.etiquetas.includes('associado') ? existente.etiquetas : [...existente.etiquetas, 'associado']
    const { error } = await sb.from('contactos').update({
      etiquetas,
      pedido_adesao_em: existente.pedido_adesao_em ?? dia,
      updated_at: agora,
    }).eq('id', contactoId)
    if (error) throw new Error(error.message)
  } else {
    const { data: pessoa } = await sb.from('people').select('id').eq('email', pedido.email).maybeSingle()
    const { data: novo, error } = await sb.from('contactos').insert({
      tipo_registo: 'pessoa',
      nome: pedido.nome_completo,
      email: pedido.email,
      etiquetas: ['associado'],
      pedido_adesao_em: dia,
      person_id: pessoa?.id ?? null,
      estado: 'a_avaliar',
      origem: 'Pedido de adesão (Tally)',
    }).select('id').single()
    if (error) throw new Error(error.message)
    contactoId = novo.id
  }

  const { error } = await sb.from('pedidos_adesao').update({ contacto_id: contactoId, updated_at: agora }).eq('id', pedido.id)
  if (error) throw new Error(error.message)
}
