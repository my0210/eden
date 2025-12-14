/**
 * Blood Pressure Pairing
 *
 * Pairs systolic and diastolic readings that occur at the same time.
 * Only persists complete pairs.
 */
import { MetricRow } from './parseExportXml';
/**
 * Raw BP record from Apple Health
 */
export interface BpRecord {
    type: 'systolic' | 'diastolic';
    value: number;
    endDate: string;
}
/**
 * Pair blood pressure readings and emit metric rows
 *
 * Pairs systolic + diastolic readings that share the same timestamp (rounded to minute).
 * Only emits rows for complete pairs - no partial data.
 *
 * @param records - All BP records (systolic and diastolic)
 * @returns Metric rows for bp_systolic and bp_diastolic (paired)
 */
export declare function pairBloodPressure(records: BpRecord[]): MetricRow[];
//# sourceMappingURL=pairBloodPressure.d.ts.map