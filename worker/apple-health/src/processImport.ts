/**
 * Process Apple Health imports
 * 
 * PR7B.1: Stream-parse Export.xml directly from ZIP (no temp XML files)
 * PR7C: Write metrics to eden_metric_values
 */

import { getSupabase, AppleHealthImport } from './supabase'
import { log } from './logger'
import { downloadZip, cleanupZipFile } from './download'
import { findExportXmlStream } from './unzip'
import { parseExportXmlStream, formatParseSummaryForLog, ParseSummary } from './parseExportXml'
import { writeMetrics, WriteResult } from './writeMetrics'
import { triggerScorecardGeneration } from './triggerScorecardGeneration'

export interface ProcessResult {
  success: boolean
  summary?: ParseSummary
  writeResult?: WriteResult
  errorMessage?: string
}

/**
 * Process an Apple Health import
 * 
 * Flow:
 * 1. Download ZIP from Supabase Storage to /tmp
 * 2. Open ZIP and find Export.xml entry (case-insensitive)
 * 3. Stream-parse Export.xml directly from ZIP (no extraction to disk)
 * 4. Write metrics to eden_metric_values (idempotent)
 * 5. Mark import as completed
 * 
 * On error, marks import as failed with error message.
 * Always cleans up the ZIP file (no XML temp file to clean up).
 */
export async function processImport(importRow: AppleHealthImport): Promise<ProcessResult> {
  const supabase = getSupabase()
  const startTime = Date.now()
  const importId = importRow.id
  const userId = importRow.user_id

  log.info('Processing Apple Health import', {
    import_id: importId,
    user_id: userId,
    file_path: importRow.file_path,
    file_size: importRow.file_size,
    file_size_mb: importRow.file_size 
      ? Math.round(importRow.file_size / 1024 / 1024 * 10) / 10 
      : undefined,
  })

  let zipPath: string | null = null

  try {
    // Step 1: Download ZIP from storage
    zipPath = await downloadZip(importRow.file_path, importId)

    // Step 2: Find Export.xml in the ZIP and get a stream
    const exportEntry = await findExportXmlStream(zipPath)
    
    log.info('Starting stream parse', {
      import_id: importId,
      export_path: exportEntry.path,
      uncompressed_size_mb: exportEntry.uncompressedSize 
        ? Math.round(exportEntry.uncompressedSize / 1024 / 1024 * 10) / 10 
        : undefined,
    })

    // Step 3: Stream-parse Export.xml directly from ZIP
    const { summary, rows } = await parseExportXmlStream(exportEntry.stream)

    // Log the parse summary
    const summaryForLog = formatParseSummaryForLog(summary)
    log.info('Parse summary', {
      import_id: importId,
      ...summaryForLog,
    })

    // Step 4: Write metrics to eden_metric_values
    let writeResult: WriteResult = {
      inserted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    if (rows.length > 0) {
      writeResult = await writeMetrics(supabase, userId, rows)
      
      log.info('Metrics written', {
        import_id: importId,
        user_id: userId,
        inserted: writeResult.inserted,
        skipped: writeResult.skipped,
        failed: writeResult.failed,
      })
    } else {
      log.info('No persistable metrics found', {
        import_id: importId,
        user_id: userId,
      })
    }

    // Step 5: Mark import as completed
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('apple_health_imports')
      .update({
        status: 'completed',
        processed_at: now,
      })
      .eq('id', importId)

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`)
    }

    // Trigger scorecard generation (non-blocking, failures don't affect import success)
    triggerScorecardGeneration(userId)
      .catch(err => {
        log.warn('Scorecard generation failed (non-fatal)', {
          import_id: importId,
          user_id: userId,
          error: err instanceof Error ? err.message : String(err),
        })
      })

    const durationMs = Date.now() - startTime
    const durationSec = Math.round(durationMs / 100) / 10

    log.info('Import completed successfully', {
      import_id: importId,
      user_id: userId,
      duration_sec: durationSec,
      records_scanned: summary.totalRecordsScanned,
      records_matched: summary.totalRecordsMatched,
      metrics_inserted: writeResult.inserted,
      metrics_skipped: writeResult.skipped,
    })

    return {
      success: true,
      summary,
      writeResult,
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const now = new Date().toISOString()

    log.error('Import failed', {
      import_id: importId,
      user_id: userId,
      error: errorMessage,
      duration_sec: Math.round((Date.now() - startTime) / 1000),
    })

    // Update status to failed
    const { error: updateError } = await supabase
      .from('apple_health_imports')
      .update({
        status: 'failed',
        failed_at: now,
        error_message: errorMessage.slice(0, 500),
      })
      .eq('id', importId)

    if (updateError) {
      log.error('Failed to update failed status', {
        import_id: importId,
        error: updateError.message,
      })
    }

    return {
      success: false,
      errorMessage,
    }

  } finally {
    // Only clean up the ZIP file (no XML temp file to clean up anymore)
    if (zipPath) {
      cleanupZipFile(zipPath)
    }
  }
}
