// Números da barra do separador RCP (SPEC 17.3) e o nome de quem está com sessão (17.2).
// Leituras só: a edição aberta e edition_summary, como o painel; perfis.

import { supabase } from '../lib/supabase.js'

function semErro({ data, error }) {
  if (error) throw error
  return data
}

export async function lerNumerosRcp() {
  const [aberta, resumo] = await Promise.all([
    supabase.from('editions').select('code, room_count').eq('is_open', true).maybeSingle().then(semErro),
    supabase
      .from('edition_summary')
      .select('registered, present, registered_absent')
      .eq('is_open', true)
      .maybeSingle()
      .then(semErro),
  ])
  return [
    { rotulo: aberta ? `Presenças no ${aberta.code}` : 'Presenças (sem edição aberta)', numero: resumo?.present ?? null },
    { rotulo: 'Inscritos', numero: resumo?.registered ?? null },
    { rotulo: 'Ausentes', numero: resumo?.registered_absent ?? null },
    { rotulo: 'Contagem de sala', numero: aberta?.room_count ?? null },
  ]
}

// Nome em perfis; sem perfil, o email da sessão.
export async function lerNomeDaSessao(id, email) {
  const perfil = semErro(await supabase.from('perfis').select('nome').eq('id', id).maybeSingle())
  return perfil?.nome || email
}
