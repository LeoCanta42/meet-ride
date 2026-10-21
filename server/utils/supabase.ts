import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

let clientInstance: SupabaseClient<Database> | null = null
let cachedKey = ''

export function getSupabaseConfig() {
  let runtimeUrl = ''
  let runtimeKey = ''
  try {
    const rc = useRuntimeConfig()
    runtimeUrl = (rc.supabaseUrl as string) || (rc.public?.supabase?.url as string) || ''
    runtimeKey = (rc.supabaseKey as string) || (rc.public?.supabase?.key as string) || ''
  } catch {
    // outside request context
  }

  const url = (
    process.env.SUPABASE_URL ||
    process.env.NUXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    runtimeUrl ||
    ''
  ).trim()

  const key = (
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NUXT_PUBLIC_SUPABASE_KEY ||
    process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    runtimeKey ||
    ''
  ).trim()

  const isPlaceholder =
    !url ||
    !key ||
    url.includes('your-project.supabase.co') ||
    key.includes('your-anon-publishable-key') ||
    key.includes('your-service-role-secret-key')

  return {
    url,
    key,
    isConfigured: !isPlaceholder
  }
}

export function getSupabaseServerClient(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig()
  if (!config.isConfigured) return null

  const cacheSignature = `${config.url}::${config.key}`
  if (!clientInstance || cachedKey !== cacheSignature) {
    cachedKey = cacheSignature
    clientInstance = createClient<Database>(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  }

  return clientInstance
}
