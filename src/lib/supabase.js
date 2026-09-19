import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient = null

export function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)
  }
  return supabaseClient
}

export const isMissingSupabaseConfig = !SUPABASE_URL || !SUPABASE_KEY
