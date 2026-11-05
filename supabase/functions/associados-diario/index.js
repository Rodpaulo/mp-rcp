// associados-diario — o relógio dos Associados (SPEC §16.7, §16.8).
// Chamada por pg_cron + pg_net às 07:00 e 08:00 UTC; só trabalha quando são
// 9 horas em Bruxelas (ou com {"forcar": true} no corpo, para testes).
// Protegida pelo cabeçalho x-cron-secret (CRON_SECRET).
// Idempotente: correr duas vezes no mesmo dia não envia nada duas vezes.
//
// Ordem de cada passagem:
//   1. Abertura das quotas do ano (Janeiro, a partir de 2028).
//   2. Pedidos em aberto: email 4, 3-A ou o lembrete do intervalo (um por pedido).
//   3. Associados activos: 9/10, 16, 17, 12, 13.

import {
  FIM_FUNDADORES, anoBissexto, camposConfiguracao, camposPedido, clienteServico, dataBruxelas, dataPorExtenso,
  diasEntre, enviarEmail, euros, horaBruxelas, iguais, json, lerConfiguracao, lerEmailsTipo, numero,
} from '../_shared/emails.js'

// [de, até (exclusive), chave]: só sai o lembrete do intervalo em que o pedido está.
const LEMBRETES = [
  [10, 30, '05_lembrete_10_dias'],
  [30, 60, '06_lembrete_30_dias'],
  [60, 90, '07_lembrete_60_dias'],
  [90, 120, '08_lembrete_90_dias'],
]
const PRIMEIRO_ANO_ABERTURA = 2028

Deno.serve(async (req) => {
  const segredo = Deno.env.get('CRON_SECRET')
  if (!segredo) return json(500, { erro: 'CRON_SECRET não está definido.' })
  if (!iguais(req.headers.get('x-cron-secret') ?? '', segredo)) return json(401, { erro: 'Não autorizado.' })

  const pedidoCorpo = await req.json().catch(() => ({}))
  const agora = new Date()
  if (!pedidoCorpo?.forcar && horaBruxelas(agora) !== 9) {
    return json(200, { resultado: 'fora_de_hora', hora_bruxelas: horaBruxelas(agora) })
  }

  const hoje = dataBruxelas(agora)
  const relatorio = { hoje, enviados: [], falhados: [], avisos: [] }

  try {
    const sb = clienteServico()
    const [config, tipos] = await Promise.all([lerConfiguracao(sb), lerEmailsTipo(sb)])

    // Envios que já contam (não falhados), para não perguntar à base a cada passo.
    const feitos = new Set()
    const chave = (tipo, pedidoId, associadoId, periodo = '') => `${tipo}|${pedidoId ?? ''}|${associadoId ?? ''}|${periodo}`
    {
      const { data, error } = await sb.from('emails_enviados')
        .select('email_tipo, pedido_id, associado_id, periodo').neq('estado', 'falhou')
      if (error) throw new Error(`emails_enviados: ${error.message}`)
      for (const e of data) feitos.add(chave(e.email_tipo, e.pedido_id, e.associado_id, e.periodo))
    }
    const jaFeito = (tipo, { pedidoId = null, associadoId = null, periodo = '' }) =>
      feitos.has(chave(tipo, pedidoId, associadoId, periodo))

    const enviar = async (tipoChave, { pedidoId = null, associadoId = null, periodo = '', para, campos, quem }) => {
      const r = await enviarEmail(sb, { tipo: tipos[tipoChave], pedidoId, associadoId, periodo, para, campos, hoje })
      const linha = { email: tipoChave, periodo: periodo || undefined, quem }
      if (r.resultado === 'enviado') {
        feitos.add(chave(tipoChave, pedidoId, associadoId, periodo))
        relatorio.enviados.push(linha)
      } else if (r.resultado === 'falhou') {
        relatorio.falhados.push({ ...linha, motivo: r.motivo })
      } else if (r.resultado === 'ja_enviado') {
        feitos.add(chave(tipoChave, pedidoId, associadoId, periodo))
      }
      return r.resultado
    }

    const ano = Number(hoje.slice(0, 4))
    const mes = Number(hoje.slice(5, 7))
    const dia = Number(hoje.slice(8, 10))

    // ---------- 1. Abertura das quotas do ano -------------------------
    if (ano >= PRIMEIRO_ANO_ABERTURA && mes === 1) {
      const valor = numero(config[`valor_quota_${ano}`])
      if (valor === null) {
        relatorio.avisos.push(`Falta valor_quota_${ano} na configuração: as quotas de ${ano} não foram abertas.`)
      } else {
        const { data: activos, error } = await sb.from('associados').select('id').eq('estado', 'activo')
        if (error) throw new Error(`associados: ${error.message}`)
        if (activos.length) {
          const { error: erroQ } = await sb.from('quotas').upsert(
            activos.map((a) => ({ associado_id: a.id, ano, valor, estado: 'nao_paga' })),
            { onConflict: 'associado_id,ano', ignoreDuplicates: true },
          )
          if (erroQ) throw new Error(`quotas: ${erroQ.message}`)
        }
      }
    }

    // ---------- 2. Pedidos em aberto -------------------------------
    {
      const { data: pedidos, error } = await sb.from('pedidos_adesao').select('*')
        .in('estado', ['recebido', 'instrucoes_enviadas']).order('data_pedido')
      if (error) throw new Error(`pedidos_adesao: ${error.message}`)

      const inicio3a = config.data_ultimos_dias_fundador
      const periodo3a = inicio3a && hoje >= inicio3a && hoje <= FIM_FUNDADORES

      for (const p of pedidos) {
        const campos = camposPedido(p, config, hoje)
        const base = { pedidoId: p.id, para: p.email, campos, quem: p.email }

        // 4 primeiro; sem o 4, nada mais.
        if (!jaFeito('04_pedido_recebido', { pedidoId: p.id })) {
          const r = await enviar('04_pedido_recebido', base)
          if (r === 'enviado' || r === 'ja_enviado') await marcarInstrucoes(sb, p)
          continue
        }
        if (p.estado === 'recebido') await marcarInstrucoes(sb, p)

        // 3-A, no período dele, à frente do lembrete do dia.
        if (periodo3a && !jaFeito('03a_ultimos_dias_sem_pagamento', { pedidoId: p.id })) {
          await enviar('03a_ultimos_dias_sem_pagamento', base)
          continue
        }

        const dias = diasEntre(dataBruxelas(p.data_pedido), hoje)
        const lembrete = LEMBRETES.find(([de, ate]) => dias >= de && dias < ate)
        if (lembrete && !jaFeito(lembrete[2], { pedidoId: p.id })) await enviar(lembrete[2], base)
      }
    }

    // ---------- 3. Associados activos -------------------------------
    {
      const { data: associados, error } = await sb.from('associados')
        .select(`id, numero, fundador, estado,
                 contacto:contactos!associados_contacto_id_fkey(nome, email),
                 pedido:pedidos_adesao!associados_pedido_id_fkey(nome_completo, nome_emails, email, aniversario, data_pedido)`)
        .eq('estado', 'activo').order('numero')
      if (error) throw new Error(`associados: ${error.message}`)

      const { data: quotas, error: erroQ } = await sb.from('quotas').select('associado_id, ano, valor, estado')
      if (erroQ) throw new Error(`quotas: ${erroQ.message}`)
      const quotasDe = (id) => quotas.filter((q) => q.associado_id === id)

      const trimestre = Math.ceil(mes / 3)
      const hojeDdMm = `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`

      for (const a of associados) {
        const para = a.pedido?.email ?? a.contacto?.email ?? null
        const primeiroNome = a.pedido?.nome_emails?.trim() || a.contacto?.nome?.trim().split(/\s+/)[0]
        const comuns = {
          ...camposConfiguracao(config, ano),
          primeiro_nome: primeiroNome,
          nome_completo: a.pedido?.nome_completo ?? a.contacto?.nome,
          email: para,
          aniversario: a.pedido?.aniversario,
          data_pedido: a.pedido ? dataPorExtenso(dataBruxelas(a.pedido.data_pedido)) : null,
        }
        const quem = `n.º ${a.numero}`
        const base = { associadoId: a.id, para, quem }
        const minhas = quotasDe(a.id)
        const doAno = minhas.find((q) => q.ano === ano)

        // 9 ou 10: boas-vindas, uma vez, na primeira passagem depois da admissão.
        if (!jaFeito('09_admissao_fundador', base) && !jaFeito('10_admissao', base)) {
          const pagas = minhas.filter((q) => q.estado === 'paga').map((q) => q.ano)
          const anoPago = pagas.length ? String(Math.max(...pagas)) : null
          await enviar(a.fundador ? '09_admissao_fundador' : '10_admissao', { ...base, campos: { ...comuns, ano: anoPago } })
        }

        // 16: renovação, em Janeiro, para a quota do ano aberta pela função.
        if (ano >= PRIMEIRO_ANO_ABERTURA && mes === 1 && doAno?.estado === 'nao_paga') {
          const periodo = String(ano)
          if (!jaFeito('16_renovacao_quota', { ...base, periodo })) {
            await enviar('16_renovacao_quota', { ...base, periodo, campos: { ...comuns, ano: periodo, valor_quota: euros(doAno.valor) } })
          }
        }

        // 17: um por trimestre (2.º a 4.º) enquanto a quota do ano estiver por pagar.
        if (trimestre >= 2 && doAno?.estado === 'nao_paga') {
          const periodo = `${ano}-T${trimestre}`
          if (!jaFeito('17_lembrete_quota', { ...base, periodo })) {
            await enviar('17_lembrete_quota', { ...base, periodo, campos: { ...comuns, ano: String(ano), valor_quota: euros(doAno.valor) } })
          }
        }

        // 12: aniversário, só com o dia preenchido; 29/02 sai a 28/02 nos anos comuns.
        const aniv = a.pedido?.aniversario
        const eHoje = aniv && (aniv === hojeDdMm || (aniv === '29/02' && hojeDdMm === '28/02' && !anoBissexto(ano)))
        if (eHoje && !jaFeito('12_aniversario', { ...base, periodo: String(ano) })) {
          await enviar('12_aniversario', { ...base, periodo: String(ano), campos: comuns })
        }

        // 13: boas férias, uma vez por ano, entre 1 e 15 de Agosto.
        if (mes === 8 && dia <= 15 && !jaFeito('13_boas_ferias', { ...base, periodo: String(ano) })) {
          await enviar('13_boas_ferias', { ...base, periodo: String(ano), campos: comuns })
        }
      }
    }

    return json(200, relatorio)
  } catch (e) {
    console.error(e)
    return json(500, { ...relatorio, erro: e?.message ?? String(e) })
  }
})

async function marcarInstrucoes(sb, pedido) {
  if (pedido.estado !== 'recebido') return
  const { error } = await sb.from('pedidos_adesao')
    .update({ estado: 'instrucoes_enviadas', updated_at: new Date().toISOString() })
    .eq('id', pedido.id).eq('estado', 'recebido')
  if (error) console.error('pedidos_adesao', pedido.id, error.message)
  pedido.estado = 'instrucoes_enviadas'
}
