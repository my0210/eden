"use strict";
/**
 * Stream-parse Apple Health export.xml
 *
 * Uses SAX parser to stream through the XML without loading it all into memory.
 * Extracts records matching our mapped HK types and emits metric rows for DB insert.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExportXml = parseExportXml;
exports.formatParseSummaryForLog = formatParseSummaryForLog;
const fs = __importStar(require("fs"));
const sax = __importStar(require("sax"));
const logger_1 = require("./logger");
const mapping_1 = require("./mapping");
// HK types we'll persist to eden_metric_values
// Sleep and blood_pressure are log-only until we implement proper aggregation
const PERSIST_HK_TYPES = new Set([
    'HKQuantityTypeIdentifierVO2Max',
    'HKQuantityTypeIdentifierRestingHeartRate',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierBodyFatPercentage',
]);
// Map HK types to our canonical metric codes
const HK_TO_METRIC_CODE = {
    'HKQuantityTypeIdentifierVO2Max': 'vo2max',
    'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
    'HKQuantityTypeIdentifierBodyMass': 'body_composition', // Will be mapped to body_mass in DB
    'HKQuantityTypeIdentifierBodyFatPercentage': 'body_composition', // Will be mapped to body_fat_percentage
};
// Map HK types to specific DB metric codes (more granular than the canonical)
const HK_TO_DB_METRIC_CODE = {
    'HKQuantityTypeIdentifierVO2Max': 'vo2max',
    'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
    'HKQuantityTypeIdentifierBodyMass': 'body_mass',
    'HKQuantityTypeIdentifierBodyFatPercentage': 'body_fat_percentage',
};
/**
 * Parse export.xml and extract metrics
 *
 * @param xmlPath - Path to the extracted export.xml
 * @param onRowsBatch - Optional callback for streaming writes (called with batches of rows)
 * @returns ParseResult with summary and all rows
 */
function parseExportXml(xmlPath, onRowsBatch) {
    return new Promise((resolve, reject) => {
        const relevantHkTypes = (0, mapping_1.getAllHkTypes)();
        const hkTypeToMapping = (0, mapping_1.buildHkTypeToMappingLookup)();
        const summary = {
            totalRecordsScanned: 0,
            totalRecordsMatched: 0,
            byMetricCode: {},
            sleepCategories: {},
            bloodPressure: {
                systolicCount: 0,
                diastolicCount: 0,
            },
            bodyComposition: {
                bodyMassCount: 0,
                bodyFatCount: 0,
                leanBodyMassCount: 0,
            },
            errors: [],
        };
        const allRows = [];
        let rowBuffer = [];
        const BUFFER_SIZE = 1000; // Flush to callback every 1000 rows
        // Initialize byMetricCode for all our mapped metrics
        for (const [hkType, mapping] of hkTypeToMapping) {
            if (!summary.byMetricCode[mapping.metric_code]) {
                summary.byMetricCode[mapping.metric_code] = {
                    hkType: hkType,
                    count: 0,
                    newestTimestamp: null,
                    oldestTimestamp: null,
                    sampleValues: [],
                };
            }
        }
        const parser = sax.createStream(true, { trim: true });
        const fileStream = fs.createReadStream(xmlPath, { encoding: 'utf8' });
        const LOG_EVERY_N = 100000;
        const flushBuffer = async () => {
            if (rowBuffer.length > 0 && onRowsBatch) {
                await onRowsBatch(rowBuffer);
                rowBuffer = [];
            }
        };
        parser.on('opentag', (node) => {
            if (node.name !== 'Record')
                return;
            summary.totalRecordsScanned++;
            if (summary.totalRecordsScanned % LOG_EVERY_N === 0) {
                logger_1.log.debug('Parse progress', {
                    records_scanned: summary.totalRecordsScanned,
                    records_matched: summary.totalRecordsMatched,
                    rows_collected: allRows.length,
                });
            }
            const attrs = node.attributes;
            const type = attrs.type;
            const value = attrs.value;
            const unit = attrs.unit;
            const endDate = attrs.endDate;
            const startDate = attrs.startDate;
            if (!type || !relevantHkTypes.has(type)) {
                return;
            }
            summary.totalRecordsMatched++;
            const mapping = hkTypeToMapping.get(type);
            if (!mapping)
                return;
            const metricCode = mapping.metric_code;
            const metricSummary = summary.byMetricCode[metricCode];
            if (metricSummary) {
                metricSummary.count++;
                const timestamp = endDate || startDate;
                if (timestamp) {
                    if (!metricSummary.newestTimestamp || timestamp > metricSummary.newestTimestamp) {
                        metricSummary.newestTimestamp = timestamp;
                    }
                    if (!metricSummary.oldestTimestamp || timestamp < metricSummary.oldestTimestamp) {
                        metricSummary.oldestTimestamp = timestamp;
                    }
                }
                if (metricSummary.sampleValues.length < 5 && value) {
                    metricSummary.sampleValues.push(`${value} ${unit || ''}`.trim());
                }
            }
            // Special tracking
            if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && value) {
                summary.sleepCategories[value] = (summary.sleepCategories[value] || 0) + 1;
            }
            if (type === 'HKQuantityTypeIdentifierBloodPressureSystolic') {
                summary.bloodPressure.systolicCount++;
            }
            else if (type === 'HKQuantityTypeIdentifierBloodPressureDiastolic') {
                summary.bloodPressure.diastolicCount++;
            }
            if (type === 'HKQuantityTypeIdentifierBodyMass') {
                summary.bodyComposition.bodyMassCount++;
            }
            else if (type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
                summary.bodyComposition.bodyFatCount++;
            }
            else if (type === 'HKQuantityTypeIdentifierLeanBodyMass') {
                summary.bodyComposition.leanBodyMassCount++;
            }
            // === EMIT ROW FOR PERSISTENCE ===
            // Only for types we want to persist (not sleep/BP yet)
            if (PERSIST_HK_TYPES.has(type) && value && (endDate || startDate)) {
                const dbMetricCode = HK_TO_DB_METRIC_CODE[type];
                if (dbMetricCode) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        const row = {
                            metric_code: dbMetricCode,
                            value_raw: numValue,
                            unit: unit || '',
                            measured_at: endDate || startDate,
                            source: 'apple_health',
                        };
                        allRows.push(row);
                        rowBuffer.push(row);
                    }
                }
            }
        });
        parser.on('error', (err) => {
            summary.errors.push(err.message);
            logger_1.log.warn('SAX parser error (continuing)', { error: err.message });
            parser.resume();
        });
        parser.on('end', async () => {
            try {
                // Flush any remaining rows
                await flushBuffer();
                logger_1.log.info('XML parsing complete', {
                    total_scanned: summary.totalRecordsScanned,
                    total_matched: summary.totalRecordsMatched,
                    rows_to_insert: allRows.length,
                });
                resolve({ summary, rows: allRows });
            }
            catch (err) {
                reject(err);
            }
        });
        fileStream.on('error', (err) => {
            reject(new Error(`Failed to read XML file: ${err.message}`));
        });
        fileStream.pipe(parser);
    });
}
/**
 * Format parse summary for logging
 */
function formatParseSummaryForLog(summary) {
    const metrics = {};
    for (const [code, data] of Object.entries(summary.byMetricCode)) {
        if (data.count > 0) {
            metrics[code] = {
                count: data.count,
                newest: data.newestTimestamp,
                samples: data.sampleValues,
            };
        }
    }
    return {
        total_scanned: summary.totalRecordsScanned,
        total_matched: summary.totalRecordsMatched,
        metrics,
        sleep_categories: Object.keys(summary.sleepCategories).length > 0
            ? summary.sleepCategories
            : undefined,
        blood_pressure: summary.bloodPressure.systolicCount > 0
            ? summary.bloodPressure
            : undefined,
        body_composition: summary.bodyComposition.bodyMassCount > 0
            ? summary.bodyComposition
            : undefined,
        errors: summary.errors.length > 0 ? summary.errors : undefined,
    };
}
//# sourceMappingURL=parseExportXml.js.map