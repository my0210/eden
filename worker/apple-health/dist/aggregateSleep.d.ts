/**
 * Sleep Aggregation
 *
 * Converts Apple Health SleepAnalysis records into sleep_duration metrics.
 * Computes 7-day rolling average of sleep hours.
 */
import { MetricRow } from './parseExportXml';
/**
 * Raw sleep record from Apple Health
 */
export interface SleepRecord {
    value: string;
    startDate: string;
    endDate: string;
}
/**
 * Aggregate sleep records into daily totals and 7-day average
 *
 * @param records - All sleep records from Apple Health
 * @returns Metric rows for sleep duration (7-day rolling averages)
 */
export declare function aggregateSleep(records: SleepRecord[]): MetricRow[];
//# sourceMappingURL=aggregateSleep.d.ts.map