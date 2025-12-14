/**
 * Stub processor for Apple Health imports
 *
 * PR7A: Just marks the import as completed (no actual processing)
 * PR7B will replace this with real ZIP download and XML parsing
 */
import { AppleHealthImport } from './supabase';
export interface ProcessResult {
    success: boolean;
    errorMessage?: string;
}
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
export declare function processImport(importRow: AppleHealthImport): Promise<ProcessResult>;
//# sourceMappingURL=processImportStub.d.ts.map