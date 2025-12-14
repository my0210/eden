/**
 * Process Apple Health imports
 *
 * PR7B: Download → Unzip → Parse export.xml → Log summary
 * (No DB writes to eden_metric_values yet - that's PR7C)
 */
import { AppleHealthImport } from './supabase';
import { ParseSummary } from './parseExportXml';
export interface ProcessResult {
    success: boolean;
    summary?: ParseSummary;
    errorMessage?: string;
}
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
export declare function processImport(importRow: AppleHealthImport): Promise<ProcessResult>;
//# sourceMappingURL=processImport.d.ts.map