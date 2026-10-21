import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Falta configurar o Supabase: define VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ficheiro .env (vê .env.example).',
  )
}

export const supabase = createClient(url, publishableKey)
