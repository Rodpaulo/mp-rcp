// enviar-teste — "Enviar teste para mim" na pré-visualização dos emails-tipo (SPEC §16.18).
// Chamada pelo admin com a sessão de quem carrega (verify_jwt). Envia pelo Resend o assunto e o
// corpo já preenchidos na pré-visualização para o email da própria sessão, com o assunto
// prefixado "[TESTE] ". Não grava em emails_enviados nem usa a chave de serviço.
// Corpo (JSON): { assunto, corpo }.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarResend } from '../_shared/emails.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAXIMO = 20000 // caracteres: um email-tipo cabe largamente

function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Só POST.' })

  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Sem sessão.' })

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await sb.auth.getUser(token)
    const email = data?.user?.email
    if (error || !email) return resposta(401, { erro: 'Sessão inválida.' })
    const { data: perfil } = await sb.from('perfis').select('id').eq('id', data.user.id).maybeSingle()
    if (!perfil) return resposta(403, { erro: 'Só uma conta da direcção pode enviar testes.' })

    const { assunto, corpo } = await req.json().catch(() => ({}))
    if (typeof assunto !== 'string' || typeof corpo !== 'string' || !assunto.trim() || !corpo.trim()) {
      return resposta(400, { erro: 'Falta o assunto ou o texto.' })
    }
    if (assunto.length + corpo.length > MAXIMO) return resposta(400, { erro: 'Texto demasiado longo.' })

    const r = await enviarResend({ para: email, assunto: `[TESTE] ${assunto.trim()}`, texto: corpo })
    return r.ok ? resposta(200, { para: email }) : resposta(502, { erro: `O Resend recusou o envio: ${r.resposta}` })
  } catch (e) {
    console.error(e)
    return resposta(500, { erro: e?.message ?? String(e) })
  }
})
