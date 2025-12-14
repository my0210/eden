"use strict";
/**
 * Sleep Aggregation
 *
 * Converts Apple Health SleepAnalysis records into sleep_duration metrics.
 * Computes 7-day rolling average of sleep hours.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateSleep = aggregateSleep;
const logger_1 = require("./logger");
/**
 * Apple Health sleep category values that count as "asleep"
 * Reference: https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis
 */
const ASLEEP_CATEGORIES = new Set([
    'HKCategoryValueSleepAnalysisAsleepUnspecified',
    'HKCategoryValueSleepAnalysisAsleepCore',
    'HKCategoryValueSleepAnalysisAsleepDeep',
    'HKCategoryValueSleepAnalysisAsleepREM',
    'HKCategoryValueSleepAnalysisAsleep', // Legacy value
]);
/**
 * Values to ignore (in bed but not asleep)
 */
const IGNORED_CATEGORIES = new Set([
    'HKCategoryValueSleepAnalysisInBed',
    'HKCategoryValueSleepAnalysisAwake',
]);
/**
 * Get the date string (YYYY-MM-DD) for a timestamp
 * Uses the END date's local date as the "sleep night"
 */
function getDateKey(endDateIso) {
    const date = new Date(endDateIso);
    return date.toISOString().split('T')[0];
}
/**
 * Compute duration in hours between two ISO timestamps
 */
function computeDurationHours(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return (end - start) / (1000 * 60 * 60);
}
/**
 * Aggregate sleep records into daily totals and 7-day average
 *
 * @param records - All sleep records from Apple Health
 * @returns Metric rows for sleep duration (7-day rolling averages)
 */
function aggregateSleep(records) {
    if (records.length === 0) {
        logger_1.log.info('No sleep records to aggregate');
        return [];
    }
    // Step 1: Sum asleep hours per day
    const hoursPerDay = new Map();
    let asleepCount = 0;
    let ignoredCount = 0;
    let unknownCount = 0;
    for (const record of records) {
        if (ASLEEP_CATEGORIES.has(record.value)) {
            const dateKey = getDateKey(record.endDate);
            const hours = computeDurationHours(record.startDate, record.endDate);
            // Sanity check: ignore unreasonable durations
            if (hours < 0 || hours > 24) {
                logger_1.log.warn('Invalid sleep duration', {
                    hours,
                    start: record.startDate,
                    end: record.endDate
                });
                continue;
            }
            hoursPerDay.set(dateKey, (hoursPerDay.get(dateKey) || 0) + hours);
            asleepCount++;
        }
        else if (IGNORED_CATEGORIES.has(record.value)) {
            ignoredCount++;
        }
        else {
            unknownCount++;
        }
    }
    logger_1.log.info('Sleep records processed', {
        total: records.length,
        asleep_records: asleepCount,
        ignored_inbed: ignoredCount,
        unknown_category: unknownCount,
        days_with_data: hoursPerDay.size,
    });
    if (hoursPerDay.size === 0) {
        logger_1.log.info('No valid sleep days computed');
        return [];
    }
    // Step 2: Sort dates and compute 7-day rolling averages
    const sortedDates = Array.from(hoursPerDay.keys()).sort();
    const rows = [];
    // Only emit 7d averages for dates where we have at least 3 days of data in the window
    for (let i = 0; i < sortedDates.length; i++) {
        const endDate = sortedDates[i];
        // Get the 7 days ending on this date
        const windowDates = [];
        for (let j = i; j >= 0 && windowDates.length < 7; j--) {
            const candidateDate = sortedDates[j];
            // Check if within 7 days
            const daysDiff = (new Date(endDate).getTime() - new Date(candidateDate).getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff < 7) {
                windowDates.push(candidateDate);
            }
        }
        // Need at least 3 days in the window for a meaningful average
        if (windowDates.length < 3)
            continue;
        // Compute average
        const totalHours = windowDates.reduce((sum, d) => sum + (hoursPerDay.get(d) || 0), 0);
        const avgHours = totalHours / windowDates.length;
        // Round to 1 decimal place
        const roundedAvg = Math.round(avgHours * 10) / 10;
        rows.push({
            metric_code: 'sleep',
            value_raw: roundedAvg,
            unit: 'hours',
            measured_at: `${endDate}T23:59:59.000Z`, // End of day
            source: 'apple_health',
        });
    }
    // Log summary
    if (rows.length > 0) {
        const latestRow = rows[rows.length - 1];
        const oldestRow = rows[0];
        logger_1.log.info('Sleep aggregation complete', {
            days_processed: sortedDates.length,
            rows_emitted: rows.length,
            latest_7d_avg: latestRow.value_raw,
            latest_date: latestRow.measured_at,
            oldest_date: oldestRow.measured_at,
        });
    }
    return rows;
}
//# sourceMappingURL=aggregateSleep.js.map