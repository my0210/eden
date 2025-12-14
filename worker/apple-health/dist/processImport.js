"use strict";
/**
 * Process Apple Health imports
 *
 * PR7B.1: Stream-parse Export.xml directly from ZIP (no temp XML files)
 * PR7C: Write metrics to eden_metric_values
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImport = processImport;
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
const download_1 = require("./download");
const unzip_1 = require("./unzip");
const parseExportXml_1 = require("./parseExportXml");
const writeMetrics_1 = require("./writeMetrics");
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
async function processImport(importRow) {
    const supabase = (0, supabase_1.getSupabase)();
    const startTime = Date.now();
    const importId = importRow.id;
    const userId = importRow.user_id;
    logger_1.log.info('Processing Apple Health import', {
        import_id: importId,
        user_id: userId,
        file_path: importRow.file_path,
        file_size: importRow.file_size,
        file_size_mb: importRow.file_size
            ? Math.round(importRow.file_size / 1024 / 1024 * 10) / 10
            : undefined,
    });
    let zipPath = null;
    try {
        // Step 1: Download ZIP from storage
        zipPath = await (0, download_1.downloadZip)(importRow.file_path, importId);
        // Step 2: Find Export.xml in the ZIP and get a stream
        const exportEntry = await (0, unzip_1.findExportXmlStream)(zipPath);
        logger_1.log.info('Starting stream parse', {
            import_id: importId,
            export_path: exportEntry.path,
            uncompressed_size_mb: exportEntry.uncompressedSize
                ? Math.round(exportEntry.uncompressedSize / 1024 / 1024 * 10) / 10
                : undefined,
        });
        // Step 3: Stream-parse Export.xml directly from ZIP
        const { summary, rows } = await (0, parseExportXml_1.parseExportXmlStream)(exportEntry.stream);
        // Log the parse summary
        const summaryForLog = (0, parseExportXml_1.formatParseSummaryForLog)(summary);
        logger_1.log.info('Parse summary', {
            import_id: importId,
            ...summaryForLog,
        });
        // Step 4: Write metrics to eden_metric_values
        let writeResult = {
            inserted: 0,
            skipped: 0,
            failed: 0,
            errors: [],
        };
        if (rows.length > 0) {
            writeResult = await (0, writeMetrics_1.writeMetrics)(supabase, userId, rows);
            logger_1.log.info('Metrics written', {
                import_id: importId,
                user_id: userId,
                inserted: writeResult.inserted,
                skipped: writeResult.skipped,
                failed: writeResult.failed,
            });
        }
        else {
            logger_1.log.info('No persistable metrics found', {
                import_id: importId,
                user_id: userId,
            });
        }
        // Step 5: Mark import as completed
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
            .from('apple_health_imports')
            .update({
            status: 'completed',
            processed_at: now,
        })
            .eq('id', importId);
        if (updateError) {
            throw new Error(`Failed to update status: ${updateError.message}`);
        }
        const durationMs = Date.now() - startTime;
        const durationSec = Math.round(durationMs / 100) / 10;
        logger_1.log.info('Import completed successfully', {
            import_id: importId,
            user_id: userId,
            duration_sec: durationSec,
            records_scanned: summary.totalRecordsScanned,
            records_matched: summary.totalRecordsMatched,
            metrics_inserted: writeResult.inserted,
            metrics_skipped: writeResult.skipped,
        });
        return {
            success: true,
            summary,
            writeResult,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const now = new Date().toISOString();
        logger_1.log.error('Import failed', {
            import_id: importId,
            user_id: userId,
            error: errorMessage,
            duration_sec: Math.round((Date.now() - startTime) / 1000),
        });
        // Update status to failed
        const { error: updateError } = await supabase
            .from('apple_health_imports')
            .update({
            status: 'failed',
            failed_at: now,
            error_message: errorMessage.slice(0, 500),
        })
            .eq('id', importId);
        if (updateError) {
            logger_1.log.error('Failed to update failed status', {
                import_id: importId,
                error: updateError.message,
            });
        }
        return {
            success: false,
            errorMessage,
        };
    }
    finally {
        // Only clean up the ZIP file (no XML temp file to clean up anymore)
        if (zipPath) {
            (0, download_1.cleanupZipFile)(zipPath);
        }
    }
}
//# sourceMappingURL=processImport.js.map