// pretix-inscritos — "Actualizar do pretix" no separador RCP (SPEC §18.4).
// Chamada pelo admin com a sessão de quem carrega (verify_jwt): a função fala com a base com esse
// JWT e a chave pública, nunca com a chave de serviço. O RLS aplica-se; contas sem linha em perfis
// são recusadas.
//
// Corpo: vazio. Trabalha sempre sobre a edição aberta.
//   1. lê a edição aberta e o seu pretix_event, a chave pretix_organizador e o segredo
//      PRETIX_API_TOKEN; se faltar um, pára antes de chamar o pretix;
//   2. lê no pretix todas as encomendas do evento (todas as páginas), fora do modo de teste;
//   3. separa inscritos e cancelados (pretix.js);
//   4. chama importar_inscritos (migração 016) uma só vez e devolve as contagens.
// Se o pretix falhar a meio, nada é gravado.
//
// Resposta 200: { edicao, novos, ja_estavam, cancelados, marcados, invalidos }.
// Erros: { erro: <texto para mostrar tal como está>, codigo }.
// Privacidade (SPEC §18.9): nem os registos nem as respostas levam emails, nomes, o corpo das
// respostas do pretix ou o token. Os registos levam só o passo, o código da edição e o estado HTTP.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { ErroPretix, lerEncomendas, separar } from './pretix.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const USA_O_FICHEIRO = 'Usa o ficheiro, mais abaixo.'

// Textos do SPEC §18.7, tal como lá estão.
function textoDoErro(codigo, evento) {
  switch (codigo) {
    case 'sem_edicao_aberta':
      return 'Não há nenhuma edição aberta neste momento.'
    case 'sem_evento':
      return 'Esta edição não está ligada a um evento do pretix. Liga-a em Edições, mais abaixo.'
    case 'sem_chave':
    case 'sem_organizador':
      return `Falta configurar a ligação ao pretix. ${USA_O_FICHEIRO}`
    case 'chave_recusada':
      return `O pretix recusou a ligação. A chave pode ter sido revogada. ${USA_O_FICHEIRO}`
    case 'evento_nao_encontrado':
      return `O pretix não encontrou o evento «${evento}», ou a ligação não tem acesso a ele. Confirma a forma curta em Edições.`
    case 'pretix_indisponivel':
      return 'O pretix não está a responder. Tenta daqui a uns minutos, ou usa o ficheiro.'
    case 'demasiadas_encomendas':
      return 'O pretix devolveu demasiadas encomendas. Usa o ficheiro.'
    default:
      return 'Não foi possível guardar. Tenta outra vez.'
  }
}

const ESTADO_DO_ERRO = {
  sem_edicao_aberta: 409,
  sem_evento: 409,
  sem_chave: 409,
  sem_organizador: 409,
  chave_recusada: 502,
  evento_nao_encontrado: 502,
  pretix_indisponivel: 503,
  demasiadas_encomendas: 502,
  resposta_inesperada: 502,
}

function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function recusa(codigo, evento = '') {
  return resposta(ESTADO_DO_ERRO[codigo] ?? 500, { erro: textoDoErro(codigo, evento), codigo })
}

// Registo mínimo: passo, edição, código do caso e estado HTTP. Nunca dados pessoais.
function registar(passo, edicao, codigo, estadoHttp = null) {
  console.error(
    `pretix-inscritos: passo=${passo} edicao=${edicao ?? '-'} codigo=${codigo}` +
      (estadoHttp ? ` http=${estadoHttp}` : ''),
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Só POST.' })

  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Sem sessão.' })

  let edicao = null
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: utilizador, error: erroUtilizador } = await sb.auth.getUser(token)
    if (erroUtilizador || !utilizador?.user) return resposta(401, { erro: 'Sessão inválida.' })
    const { data: perfil } = await sb.from('perfis').select('id').eq('id', utilizador.user.id).maybeSingle()
    if (!perfil) return resposta(403, { erro: 'Só uma conta da direcção pode actualizar do pretix.' })

    // 1. Edição aberta, organizador e segredo.
    const { data: aberta, error: erroEdicao } = await sb
      .from('editions').select('code, pretix_event').eq('is_open', true).maybeSingle()
    if (erroEdicao) {
      registar('edicao', null, `base_${erroEdicao.code ?? 'erro'}`)
      return recusa('erro_base')
    }
    if (!aberta) return recusa('sem_edicao_aberta')
    edicao = aberta.code
    if (!aberta.pretix_event) return recusa('sem_evento')

    const { data: config, error: erroConfig } = await sb
      .from('configuracao').select('valor').eq('chave', 'pretix_organizador').maybeSingle()
    if (erroConfig) {
      registar('configuracao', edicao, `base_${erroConfig.code ?? 'erro'}`)
      return recusa('erro_base')
    }
    const organizador = config?.valor?.trim()
    if (!organizador) return recusa('sem_organizador')

    const chave = Deno.env.get('PRETIX_API_TOKEN')?.trim()
    if (!chave) {
      registar('segredo', edicao, 'sem_chave')
      return recusa('sem_chave')
    }

    // 2 e 3. Encomendas do pretix, separadas.
    let encomendas
    try {
      encomendas = await lerEncomendas({ organizador, evento: aberta.pretix_event, token: chave })
    } catch (e) {
      if (e instanceof ErroPretix) {
        registar('pretix', edicao, e.codigo, e.estadoHttp)
        return recusa(e.codigo, aberta.pretix_event)
      }
      throw e
    }
    const { inscritos, cancelados } = separar(encomendas)

    // 4. Uma só chamada à base: ou entra tudo, ou nada.
    const { data: resultado, error: erroImportar } = await sb.rpc('importar_inscritos', {
      p_edition_code: aberta.code,
      p_inscritos: inscritos,
      p_cancelados: cancelados,
    })
    if (erroImportar) {
      registar('importar', edicao, `base_${erroImportar.code ?? 'erro'}`)
      return recusa('erro_base')
    }

    return resposta(200, { edicao, ...resultado })
  } catch (e) {
    // Só o nome do erro: a mensagem pode trazer dados de uma linha.
    registar('inesperado', edicao, e?.name ?? 'erro')
    return recusa('erro_inesperado')
  }
})
