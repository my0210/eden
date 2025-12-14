/**
 * Process Apple Health imports
 *
 * PR7B.1: Stream-parse Export.xml directly from ZIP (no temp XML files)
 * PR7C: Write metrics to eden_metric_values
 */
import { AppleHealthImport } from './supabase';
import { ParseSummary } from './parseExportXml';
import { WriteResult } from './writeMetrics';
export interface ProcessResult {
    success: boolean;
    summary?: ParseSummary;
    writeResult?: WriteResult;
    errorMessage?: string;
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
export declare function processImport(importRow: AppleHealthImport): Promise<ProcessResult>;
//# sourceMappingURL=processImport.d.ts.map