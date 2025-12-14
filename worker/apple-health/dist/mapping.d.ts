/**
 * Apple Health Metric Mapping for Worker
 *
 * Copied from lib/prime-scorecard/mapping.ts
 * This is the worker's local copy to avoid importing from the app.
 *
 * IMPORTANT: Keep in sync with the app's mapping file.
 */
export type MetricCode = 'vo2max' | 'resting_hr' | 'hrv' | 'sleep' | 'blood_pressure' | 'body_composition';
/**
 * Aggregation strategy for Apple Health records
 */
export type AggregationStrategy = 'latest' | 'daily_avg' | '7d_avg' | '30d_avg';
/**
 * Mapping specification for a single Apple Health metric
 */
export type AppleHealthRecordMapping = {
    metric_code: MetricCode;
    hk_types: string[];
    unit: string;
    aggregation: AggregationStrategy;
    value_field: 'value';
    measured_at_field: 'endDate' | 'startDate';
    notes?: string;
};
/**
 * Apple Health mappings for v2-supported metrics.
 */
export declare const appleHealthMappings: AppleHealthRecordMapping[];
/**
 * Build a lookup map from HK type identifier to mapping
 */
export declare function buildHkTypeToMappingLookup(): Map<string, AppleHealthRecordMapping>;
/**
 * Get all HK type identifiers we care about
 */
export declare function getAllHkTypes(): Set<string>;
//# sourceMappingURL=mapping.d.ts.map