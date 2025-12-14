"use strict";
/**
 * Stream-parse Apple Health Export.xml
 *
 * Uses SAX parser to stream through the XML without loading it into memory.
 * Accepts a Readable stream (from ZIP entry) - no temp files needed.
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
exports.parseExportXmlStream = parseExportXmlStream;
exports.parseExportXml = parseExportXmlStream;
exports.formatParseSummaryForLog = formatParseSummaryForLog;
const sax = __importStar(require("sax"));
const logger_1 = require("./logger");
const mapping_1 = require("./mapping");
// HK types we'll persist to eden_metric_values
const PERSIST_HK_TYPES = new Set([
    'HKQuantityTypeIdentifierVO2Max',
    'HKQuantityTypeIdentifierRestingHeartRate',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierBodyFatPercentage',
]);
// Map HK types to specific DB metric codes
const HK_TO_DB_METRIC_CODE = {
    'HKQuantityTypeIdentifierVO2Max': 'vo2max',
    'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
    'HKQuantityTypeIdentifierBodyMass': 'body_mass',
    'HKQuantityTypeIdentifierBodyFatPercentage': 'body_fat_percentage',
};
/**
 * Parse Export.xml from a readable stream
 *
 * Streams directly from the ZIP entry - no temp files needed.
 * Memory-safe: uses SAX streaming parser, doesn't buffer the whole XML.
 *
 * @param xmlStream - Readable stream of Export.xml content
 * @returns ParseResult with summary and metric rows for persistence
 */
function parseExportXmlStream(xmlStream) {
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
        const startTime = Date.now();
        let lastProgressLog = startTime;
        // Initialize byMetricCode for all mapped metrics
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
        // Progress logging interval
        const LOG_EVERY_N = 100000;
        const PROGRESS_LOG_INTERVAL_MS = 30000; // Log progress every 30 seconds
        parser.on('opentag', (node) => {
            if (node.name !== 'Record')
                return;
            summary.totalRecordsScanned++;
            // Periodic progress logging
            const now = Date.now();
            if (summary.totalRecordsScanned % LOG_EVERY_N === 0 || now - lastProgressLog > PROGRESS_LOG_INTERVAL_MS) {
                const elapsedSec = Math.round((now - startTime) / 1000);
                logger_1.log.info('Parse progress', {
                    records_scanned: summary.totalRecordsScanned,
                    records_matched: summary.totalRecordsMatched,
                    rows_collected: allRows.length,
                    elapsed_sec: elapsedSec,
                    rate_per_sec: Math.round(summary.totalRecordsScanned / Math.max(1, elapsedSec)),
                });
                lastProgressLog = now;
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
            // Special tracking for complex types
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
            // Emit row for persistence (only for types we persist)
            if (PERSIST_HK_TYPES.has(type) && value && (endDate || startDate)) {
                const dbMetricCode = HK_TO_DB_METRIC_CODE[type];
                if (dbMetricCode) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        allRows.push({
                            metric_code: dbMetricCode,
                            value_raw: numValue,
                            unit: unit || '',
                            measured_at: endDate || startDate,
                            source: 'apple_health',
                        });
                    }
                }
            }
        });
        parser.on('error', (err) => {
            summary.errors.push(err.message);
            logger_1.log.warn('SAX parser error (continuing)', { error: err.message });
            parser.resume();
        });
        parser.on('end', () => {
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            logger_1.log.info('XML parsing complete', {
                total_scanned: summary.totalRecordsScanned,
                total_matched: summary.totalRecordsMatched,
                rows_to_insert: allRows.length,
                total_time_sec: totalTime,
                final_rate_per_sec: Math.round(summary.totalRecordsScanned / Math.max(1, totalTime)),
            });
            resolve({ summary, rows: allRows });
        });
        xmlStream.on('error', (err) => {
            reject(new Error(`Stream error while parsing XML: ${err.message}`));
        });
        // Pipe the stream to the SAX parser
        xmlStream.pipe(parser);
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