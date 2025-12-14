/**
 * Stream-parse Apple Health export.xml
 *
 * Uses SAX parser to stream through the XML without loading it all into memory.
 * Extracts records matching our mapped HK types and tracks counts/timestamps.
 */
/**
 * Parsed record from export.xml
 */
export interface ParsedRecord {
    type: string;
    value: string;
    unit: string;
    startDate: string;
    endDate: string;
    sourceName?: string;
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
 * Parse export.xml and extract metrics summary
 *
 * This is a LOG-ONLY pass - no database writes.
 * We're counting records and tracking timestamps.
 *
 * @param xmlPath - Path to the extracted export.xml
 * @returns Summary of parsed metrics
 */
export declare function parseExportXml(xmlPath: string): Promise<ParseSummary>;
/**
 * Format parse summary for logging
 */
export declare function formatParseSummaryForLog(summary: ParseSummary): Record<string, unknown>;
//# sourceMappingURL=parseExportXml.d.ts.map