/**
 * Stream-parse Apple Health export.xml
 *
 * Uses SAX parser to stream through the XML without loading it all into memory.
 * Extracts records matching our mapped HK types and emits metric rows for DB insert.
 */
import { MetricCode } from './mapping';
/**
 * Metric row ready for DB insert
 */
export interface MetricRow {
    metric_code: MetricCode;
    value_raw: number;
    unit: string;
    measured_at: string;
    source: 'apple_health';
}
/**
 * Summary of parsed metrics
 */
export interface ParseSummary {
    totalRecordsScanned: number;
    totalRecordsMatched: number;
    byMetricCode: Record<string, {
        hkType: string;
        count: number;
        newestTimestamp: string | null;
        oldestTimestamp: string | null;
        sampleValues: string[];
    }>;
    sleepCategories: Record<string, number>;
    bloodPressure: {
        systolicCount: number;
        diastolicCount: number;
    };
    bodyComposition: {
        bodyMassCount: number;
        bodyFatCount: number;
        leanBodyMassCount: number;
    };
    errors: string[];
}
/**
 * Parse result with both summary and rows
 */
export interface ParseResult {
    summary: ParseSummary;
    /** Metric rows ready for DB insert (vo2max, resting_hr, hrv, body_mass, body_fat_percentage) */
    rows: MetricRow[];
}
/**
 * Parse export.xml and extract metrics
 *
 * @param xmlPath - Path to the extracted export.xml
 * @param onRowsBatch - Optional callback for streaming writes (called with batches of rows)
 * @returns ParseResult with summary and all rows
 */
export declare function parseExportXml(xmlPath: string, onRowsBatch?: (rows: MetricRow[]) => Promise<void>): Promise<ParseResult>;
/**
 * Format parse summary for logging
 */
export declare function formatParseSummaryForLog(summary: ParseSummary): Record<string, unknown>;
//# sourceMappingURL=parseExportXml.d.ts.map