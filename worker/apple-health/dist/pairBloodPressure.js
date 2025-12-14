"use strict";
/**
 * Blood Pressure Pairing
 *
 * Pairs systolic and diastolic readings that occur at the same time.
 * Only persists complete pairs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pairBloodPressure = pairBloodPressure;
const logger_1 = require("./logger");
/**
 * Get a timestamp key for pairing (rounded to the minute)
 */
function getTimestampKey(endDate) {
    // Round to the minute for pairing
    const date = new Date(endDate);
    date.setSeconds(0, 0);
    return date.toISOString();
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
function pairBloodPressure(records) {
    if (records.length === 0) {
        logger_1.log.info('No blood pressure records to pair');
        return [];
    }
    // Group by timestamp
    const byTimestamp = new Map();
    for (const record of records) {
        const key = getTimestampKey(record.endDate);
        if (!byTimestamp.has(key)) {
            byTimestamp.set(key, { endDate: record.endDate });
        }
        const entry = byTimestamp.get(key);
        if (record.type === 'systolic') {
            entry.systolic = record.value;
        }
        else {
            entry.diastolic = record.value;
        }
    }
    // Emit rows only for complete pairs
    const rows = [];
    let pairedCount = 0;
    let unpairededCount = 0;
    for (const [, entry] of byTimestamp) {
        if (entry.systolic !== undefined && entry.diastolic !== undefined) {
            // Complete pair - emit both rows
            rows.push({
                metric_code: 'bp_systolic',
                value_raw: entry.systolic,
                unit: 'mmHg',
                measured_at: entry.endDate,
                source: 'apple_health',
            });
            rows.push({
                metric_code: 'bp_diastolic',
                value_raw: entry.diastolic,
                unit: 'mmHg',
                measured_at: entry.endDate,
                source: 'apple_health',
            });
            pairedCount++;
        }
        else {
            unpairededCount++;
        }
    }
    // Log summary
    if (rows.length > 0) {
        // Find newest pair
        const timestamps = rows.map(r => new Date(r.measured_at).getTime());
        const newestTime = Math.max(...timestamps);
        const newestDate = new Date(newestTime).toISOString();
        // Find the values for newest pair
        const newestSystolic = rows.find(r => r.metric_code === 'bp_systolic' && r.measured_at === new Date(newestTime).toISOString());
        const newestDiastolic = rows.find(r => r.metric_code === 'bp_diastolic' && r.measured_at === new Date(newestTime).toISOString());
        logger_1.log.info('Blood pressure pairing complete', {
            total_records: records.length,
            pairs_found: pairedCount,
            unpaired_discarded: unpairededCount,
            rows_emitted: rows.length,
            newest_pair: newestSystolic && newestDiastolic
                ? `${newestSystolic.value_raw}/${newestDiastolic.value_raw}`
                : undefined,
            newest_date: newestDate,
        });
    }
    else {
        logger_1.log.info('No complete BP pairs found', {
            total_records: records.length,
            unpaired: unpairededCount,
        });
    }
    return rows;
}
//# sourceMappingURL=pairBloodPressure.js.map