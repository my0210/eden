/**
 * Supabase client for the worker
 * Uses service role key for admin access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

let supabase: SupabaseClient | null = null

/**
 * Get the Supabase client (singleton)
 * Uses service role key for full database access
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabase
}

/**
 * Apple Health import row shape
 * Columns: status, processing_started_at, processed_at, failed_at, error_message
 */
export interface AppleHealthImport {
  id: string
  user_id: string
  status: 'uploaded' | 'processing' | 'completed' | 'failed'
  file_path: string
  file_size: number | null
  uploaded_at: string
  processing_started_at: string | null
  processed_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
}

