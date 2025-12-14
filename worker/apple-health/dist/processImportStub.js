"use strict";
/**
 * Stub processor for Apple Health imports
 *
 * PR7A: Just marks the import as completed (no actual processing)
 * PR7B will replace this with real ZIP download and XML parsing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImport = processImport;
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
/**
 * Process an Apple Health import (STUB)
 *
 * In PR7A, this just marks the import as completed.
 * In PR7B, this will:
 * 1. Download the ZIP from Supabase storage
 * 2. Stream unzip and parse export.xml
 * 3. Extract metrics and insert into eden_metric_values
 * 4. Update the import status (completed/failed)
 */
async function processImport(importRow) {
    const supabase = (0, supabase_1.getSupabase)();
    const startTime = Date.now();
    logger_1.log.info(`Processing import (STUB)`, {
        import_id: importRow.id,
        user_id: importRow.user_id,
        file_path: importRow.file_path,
        file_size: importRow.file_size,
    });
    try {
        // ========================================
        // STUB: Just mark as completed
        // PR7B will add real processing here:
        // - Download ZIP from storage
        // - Stream unzip
        // - Parse export.xml
        // - Extract metrics
        // - Insert into eden_metric_values
        // ========================================
        // Simulate some processing time (remove in PR7B)
        await new Promise(resolve => setTimeout(resolve, 500));
        const now = new Date().toISOString();
        // Update status to completed
        const { error: updateError } = await supabase
            .from('apple_health_imports')
            .update({
            status: 'completed',
            processed_at: now,
        })
            .eq('id', importRow.id);
        if (updateError) {
            throw new Error(`Failed to update status: ${updateError.message}`);
        }
        const durationMs = Date.now() - startTime;
        logger_1.log.info(`Import completed (STUB)`, {
            import_id: importRow.id,
            user_id: importRow.user_id,
            previous_status: 'processing',
            new_status: 'completed',
            duration_ms: durationMs,
        });
        return {
            success: true,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const now = new Date().toISOString();
        logger_1.log.error(`Import failed`, {
            import_id: importRow.id,
            user_id: importRow.user_id,
            error: errorMessage,
        });
        // Update status to failed
        const { error: updateError } = await supabase
            .from('apple_health_imports')
            .update({
            status: 'failed',
            failed_at: now,
            error_message: errorMessage,
        })
            .eq('id', importRow.id);
        if (updateError) {
            logger_1.log.error(`Failed to update failed status`, {
                import_id: importRow.id,
                error: updateError.message,
            });
        }
        return {
            success: false,
            errorMessage,
        };
    }
}
//# sourceMappingURL=processImportStub.js.map