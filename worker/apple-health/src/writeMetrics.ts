/**
 * Write metrics to eden_metric_values
 * 
 * Handles batched upserts with idempotency via ON CONFLICT DO NOTHING.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { log } from './logger'
import { MetricRow } from './parseExportXml'

export interface WriteResult {
  inserted: number
  skipped: number  // Due to conflict (duplicate)
  failed: number
  errors: string[]
}

// Cache for metric_code -> metric_id lookups
let metricIdCache: Map<string, string> | null = null

/**
 * Load metric definitions from DB and cache them
 */
async function loadMetricIdCache(supabase: SupabaseClient): Promise<Map<string, string>> {
  if (metricIdCache) return metricIdCache
  
  const { data, error } = await supabase
    .from('eden_metric_definitions')
    .select('id, metric_code')
  
  if (error) {
    throw new Error(`Failed to load metric definitions: ${error.message}`)
  }
  
  metricIdCache = new Map()
  for (const def of data || []) {
    metricIdCache.set(def.metric_code, def.id)
  }
  
  log.info('Loaded metric definitions', { 
    count: metricIdCache.size,
    codes: Array.from(metricIdCache.keys()),
  })
  
  return metricIdCache
}

/**
 * Write metric rows to eden_metric_values with idempotency.
 * 
 * Uses batched inserts with ON CONFLICT DO NOTHING on (import_id, metric_id, measured_at).
 * 
 * @param supabase - Supabase client with service role
 * @param userId - User ID to write metrics for
 * @param rows - Metric rows from parser
 * @param importId - Apple Health import ID (required for linking)
 * @param batchSize - Number of rows per batch (default 500)
 */
export async function writeMetrics(
  supabase: SupabaseClient,
  userId: string,
  rows: MetricRow[],
  importId: string,
  batchSize: number = 500
): Promise<WriteResult> {
  const result: WriteResult = {
    inserted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }
  
  if (rows.length === 0) {
    log.info('No metric rows to write')
    return result
  }
  
  // Load metric_code -> metric_id mapping
  const metricIdMap = await loadMetricIdCache(supabase)
  
  // Transform rows to DB format
  const dbRows: Array<{
    user_id: string
    metric_id: string
    value: number
    measured_at: string
    source: string
    import_id: string
  }> = []
  
  const unknownCodes = new Set<string>()
  
  for (const row of rows) {
    const metricId = metricIdMap.get(row.metric_code)
    if (!metricId) {
      unknownCodes.add(row.metric_code)
      result.skipped++
      continue
    }
    
    dbRows.push({
      user_id: userId,
      metric_id: metricId,
      value: row.value_raw,
      measured_at: row.measured_at,
      source: row.source,
      import_id: importId,
    })
  }
  
  if (unknownCodes.size > 0) {
    log.warn('Unknown metric codes (skipped)', { 
      codes: Array.from(unknownCodes),
      count: result.skipped,
    })
  }
  
  if (dbRows.length === 0) {
    log.info('No valid rows to insert after filtering')
    return result
  }
  
  log.info('Writing metrics', {
    total_rows: dbRows.length,
    batch_size: batchSize,
    batches: Math.ceil(dbRows.length / batchSize),
  })
  
  // Process in batches
  for (let i = 0; i < dbRows.length; i += batchSize) {
    const batch = dbRows.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(dbRows.length / batchSize)
    
    try {
      // Use upsert with ignoreDuplicates: true for ON CONFLICT DO NOTHING behavior
      // New unique constraint: (import_id, metric_id, measured_at)
      const { data, error } = await supabase
        .from('eden_metric_values')
        .upsert(batch, {
          onConflict: 'import_id,metric_id,measured_at',
          ignoreDuplicates: true,
        })
        .select('id')
      
      if (error) {
        // Check if it's a constraint violation we can handle
        if (error.code === '23505') {
          // Unique violation - these are duplicates, count as skipped
          result.skipped += batch.length
          log.debug(`Batch ${batchNum}/${totalBatches}: all duplicates`, {
            batch_size: batch.length,
          })
        } else {
          result.failed += batch.length
          result.errors.push(`Batch ${batchNum}: ${error.message}`)
          log.error(`Batch ${batchNum}/${totalBatches} failed`, {
            error: error.message,
            code: error.code,
          })
        }
      } else {
        // Success - count inserted rows
        const insertedCount = data?.length || 0
        result.inserted += insertedCount
        result.skipped += batch.length - insertedCount
        
        if (batchNum % 10 === 0 || batchNum === totalBatches) {
          log.debug(`Batch ${batchNum}/${totalBatches} complete`, {
            batch_inserted: insertedCount,
            batch_skipped: batch.length - insertedCount,
            total_inserted: result.inserted,
          })
        }
      }
    } catch (err) {
      result.failed += batch.length
      const errMsg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Batch ${batchNum}: ${errMsg}`)
      log.error(`Batch ${batchNum}/${totalBatches} exception`, { error: errMsg })
    }
  }
  
  log.info('Metrics write complete', {
    inserted: result.inserted,
    skipped: result.skipped,
    failed: result.failed,
    errors: result.errors.length > 0 ? result.errors : undefined,
  })
  
  return result
}

/**
 * Clear the metric ID cache (useful for testing)
 */
export function clearMetricIdCache(): void {
  metricIdCache = null
}

