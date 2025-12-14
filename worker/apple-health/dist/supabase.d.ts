/**
 * Supabase client for the worker
 * Uses service role key for admin access
 */
import { SupabaseClient } from '@supabase/supabase-js';
/**
 * Get the Supabase client (singleton)
 * Uses service role key for full database access
 */
export declare function getSupabase(): SupabaseClient;
/**
 * Apple Health import row shape
 */
export interface AppleHealthImport {
    id: string;
    user_id: string;
    status: 'uploaded' | 'processing' | 'completed' | 'failed';
    storage_path: string;
    file_size: number | null;
    uploaded_at: string;
    processing_started_at: string | null;
    processed_at: string | null;
    failed_at: string | null;
    error_message: string | null;
    metrics_extracted: number | null;
    created_at: string;
}
//# sourceMappingURL=supabase.d.ts.map