/**
 * Stream-parse Apple Health Export.xml
 *
 * Uses SAX parser to stream through the XML without loading it into memory.
 * Accepts a Readable stream (from ZIP entry) - no temp files needed.
 */
import { Readable } from 'stream';
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
    rows: MetricRow[];
}
/**
 * Parse Export.xml from a readable stream
 *
 * Streams directly from the ZIP entry - no temp files needed.
 * Memory-safe: uses SAX streaming parser, doesn't buffer the whole XML.
 *
 * @param xmlStream - Readable stream of Export.xml content
 * @returns ParseResult with summary and metric rows for persistence
 */
export declare function parseExportXmlStream(xmlStream: Readable): Promise<ParseResult>;
/**
 * Format parse summary for logging
 */
export declare function formatParseSummaryForLog(summary: ParseSummary): Record<string, unknown>;
export { parseExportXmlStream as parseExportXml };
//# sourceMappingURL=parseExportXml.d.ts.map