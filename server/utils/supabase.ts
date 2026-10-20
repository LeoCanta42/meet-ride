import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

let clientInstance: SupabaseClient<Database> | null = null

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NUXT_PUBLIC_SUPABASE_KEY || ''
  return {
    url,
    key,
    isConfigured: Boolean(url && key)
  }
}

export function getSupabaseServerClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig()
  if (!config.isConfigured) return null

  if (!clientInstance) {
    clientInstance = createClient<Database>(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  }

  return clientInstance
}
