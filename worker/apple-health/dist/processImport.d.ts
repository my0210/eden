/**
 * Process Apple Health imports
 *
 * PR7C: Download → Unzip → Parse export.xml → Write metrics to DB
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
 * 1. Download ZIP from Supabase Storage
 * 2. Extract export.xml from ZIP
 * 3. Stream-parse export.xml and collect metric rows
 * 4. Write metrics to eden_metric_values (idempotent)
 * 5. Mark import as completed
 *
 * On error, marks import as failed with error message.
 * Always cleans up temp files.
 */
export declare function processImport(importRow: AppleHealthImport): Promise<ProcessResult>;
//# sourceMappingURL=processImport.d.ts.map