"use strict";
/**
 * Process Apple Health imports
 *
 * PR7B: Download → Unzip → Parse export.xml → Log summary
 * (No DB writes to eden_metric_values yet - that's PR7C)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImport = processImport;
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
const download_1 = require("./download");
const unzip_1 = require("./unzip");
const parseExportXml_1 = require("./parseExportXml");
/**
 * Process an Apple Health import
 *
 * Flow:
 * 1. Download ZIP from Supabase Storage
 * 2. Extract export.xml from ZIP
 * 3. Stream-parse export.xml and count records
 * 4. Log summary and mark import as completed
 *
 * On error, marks import as failed with error message.
 * Always cleans up temp files.
 */
async function processImport(importRow) {
    const supabase = (0, supabase_1.getSupabase)();
    const startTime = Date.now();
    const importId = importRow.id;
    logger_1.log.info('Processing Apple Health import', {
        import_id: importId,
        user_id: importRow.user_id,
        file_path: importRow.file_path,
        file_size: importRow.file_size,
    });
    try {
        // Step 1: Download ZIP from storage
        const zipPath = await (0, download_1.downloadZip)(importRow.file_path, importId);
        // Step 2: Extract export.xml
        const xmlPath = await (0, unzip_1.extractExportXml)(zipPath, importId);
        // Step 3: Parse export.xml and get summary
        const summary = await (0, parseExportXml_1.parseExportXml)(xmlPath);
        // Log the detailed summary
        const summaryForLog = (0, parseExportXml_1.formatParseSummaryForLog)(summary);
        logger_1.log.info('Parse summary', {
            import_id: importId,
            ...summaryForLog,
        });
        // Step 4: Mark import as completed
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
            user_id: importRow.user_id,
            duration_sec: durationSec,
            records_scanned: summary.totalRecordsScanned,
            records_matched: summary.totalRecordsMatched,
        });
        return {
            success: true,
            summary,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const now = new Date().toISOString();
        logger_1.log.error('Import failed', {
            import_id: importId,
            user_id: importRow.user_id,
            error: errorMessage,
        });
        // Update status to failed
        const { error: updateError } = await supabase
            .from('apple_health_imports')
            .update({
            status: 'failed',
            failed_at: now,
            error_message: errorMessage.slice(0, 500), // Truncate long errors
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
        // Always clean up temp files
        (0, download_1.cleanupTempFiles)(importId);
    }
}
//# sourceMappingURL=processImport.js.map