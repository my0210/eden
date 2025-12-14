"use strict";
/**
 * Atomic claim logic for Apple Health imports
 *
 * Uses optimistic locking to ensure only one worker processes each import:
 * 1. Find the oldest 'uploaded' import
 * 2. Attempt to atomically update it to 'processing'
 * 3. If update returns 0 rows, another worker claimed it - return null
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimNextImport = claimNextImport;
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
/**
 * Attempt to claim the next available import for processing
 * Returns the claimed import or null if none available
 */
async function claimNextImport() {
    const supabase = (0, supabase_1.getSupabase)();
    // Step 1: Find the oldest uploaded import
    const { data: candidates, error: selectError } = await supabase
        .from('apple_health_imports')
        .select('*')
        .eq('status', 'uploaded')
        .order('created_at', { ascending: true })
        .limit(1);
    if (selectError) {
        logger_1.log.error('Failed to query imports:', selectError.message);
        return null;
    }
    if (!candidates || candidates.length === 0) {
        // No imports waiting to be processed
        return null;
    }
    const candidate = candidates[0];
    const now = new Date().toISOString();
    // Step 2: Attempt atomic claim via conditional update
    // This will only succeed if status is still 'uploaded'
    const { data: claimed, error: updateError } = await supabase
        .from('apple_health_imports')
        .update({
        status: 'processing',
        processing_started_at: now,
    })
        .eq('id', candidate.id)
        .eq('status', 'uploaded') // Optimistic lock - only update if still uploaded
        .select('*')
        .maybeSingle();
    if (updateError) {
        logger_1.log.error(`Failed to claim import ${candidate.id}:`, updateError.message);
        return null;
    }
    if (!claimed) {
        // Another worker claimed it between our select and update
        logger_1.log.debug(`Import ${candidate.id} was claimed by another worker`);
        return null;
    }
    logger_1.log.info(`Claimed import`, {
        import_id: claimed.id,
        user_id: claimed.user_id,
        previous_status: 'uploaded',
        new_status: 'processing',
        storage_path: claimed.storage_path,
        file_size: claimed.file_size,
    });
    return claimed;
}
//# sourceMappingURL=claimNextImport.js.map