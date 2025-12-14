/**
 * Write metrics to eden_metric_values
 *
 * Handles batched upserts with idempotency via ON CONFLICT DO NOTHING.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { MetricRow } from './parseExportXml';
export interface WriteResult {
    inserted: number;
    skipped: number;
    failed: number;
    errors: string[];
}
/**
 * Write metric rows to eden_metric_values with idempotency.
 *
 * Uses batched inserts with ON CONFLICT DO NOTHING on (user_id, metric_id, measured_at).
 *
 * @param supabase - Supabase client with service role
 * @param userId - User ID to write metrics for
 * @param rows - Metric rows from parser
 * @param batchSize - Number of rows per batch (default 500)
 */
export declare function writeMetrics(supabase: SupabaseClient, userId: string, rows: MetricRow[], batchSize?: number): Promise<WriteResult>;
/**
 * Clear the metric ID cache (useful for testing)
 */
export declare function clearMetricIdCache(): void;
//# sourceMappingURL=writeMetrics.d.ts.map