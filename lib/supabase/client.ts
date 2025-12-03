import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // During build, env vars might not be available, so we provide empty strings
  // The actual validation happens at runtime when the client is used
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

