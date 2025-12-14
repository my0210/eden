"use strict";
/**
 * Stream-parse Apple Health export.xml
 *
 * Uses SAX parser to stream through the XML without loading it all into memory.
 * Extracts records matching our mapped HK types and tracks counts/timestamps.
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
/**
 * Parse export.xml and extract metrics summary
 *
 * This is a LOG-ONLY pass - no database writes.
 * We're counting records and tracking timestamps.
 *
 * @param xmlPath - Path to the extracted export.xml
 * @returns Summary of parsed metrics
 */
function parseExportXml(xmlPath) {
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
        let recordsLogged = 0;
        const LOG_EVERY_N = 100000; // Log progress every 100k records
        parser.on('opentag', (node) => {
            // We only care about <Record> elements
            if (node.name !== 'Record')
                return;
            summary.totalRecordsScanned++;
            // Log progress periodically
            if (summary.totalRecordsScanned % LOG_EVERY_N === 0) {
                logger_1.log.debug('Parse progress', {
                    records_scanned: summary.totalRecordsScanned,
                    records_matched: summary.totalRecordsMatched,
                });
            }
            const attrs = node.attributes;
            const type = attrs.type;
            const value = attrs.value;
            const unit = attrs.unit;
            const endDate = attrs.endDate;
            const startDate = attrs.startDate;
            // Skip if not a type we care about
            if (!type || !relevantHkTypes.has(type)) {
                return;
            }
            summary.totalRecordsMatched++;
            // Get the mapping for this HK type
            const mapping = hkTypeToMapping.get(type);
            if (!mapping)
                return;
            const metricCode = mapping.metric_code;
            // Update the metric summary
            const metricSummary = summary.byMetricCode[metricCode];
            if (metricSummary) {
                metricSummary.count++;
                // Track newest/oldest timestamps
                const timestamp = endDate || startDate;
                if (timestamp) {
                    if (!metricSummary.newestTimestamp || timestamp > metricSummary.newestTimestamp) {
                        metricSummary.newestTimestamp = timestamp;
                    }
                    if (!metricSummary.oldestTimestamp || timestamp < metricSummary.oldestTimestamp) {
                        metricSummary.oldestTimestamp = timestamp;
                    }
                }
                // Keep a few sample values for debugging
                if (metricSummary.sampleValues.length < 5 && value) {
                    metricSummary.sampleValues.push(`${value} ${unit || ''}`.trim());
                }
            }
            // Special tracking for sleep categories
            if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && value) {
                summary.sleepCategories[value] = (summary.sleepCategories[value] || 0) + 1;
            }
            // Special tracking for blood pressure
            if (type === 'HKQuantityTypeIdentifierBloodPressureSystolic') {
                summary.bloodPressure.systolicCount++;
            }
            else if (type === 'HKQuantityTypeIdentifierBloodPressureDiastolic') {
                summary.bloodPressure.diastolicCount++;
            }
            // Special tracking for body composition
            if (type === 'HKQuantityTypeIdentifierBodyMass') {
                summary.bodyComposition.bodyMassCount++;
            }
            else if (type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
                summary.bodyComposition.bodyFatCount++;
            }
            else if (type === 'HKQuantityTypeIdentifierLeanBodyMass') {
                summary.bodyComposition.leanBodyMassCount++;
            }
        });
        parser.on('error', (err) => {
            // SAX parser errors are often recoverable - log but continue
            summary.errors.push(err.message);
            logger_1.log.warn('SAX parser error (continuing)', { error: err.message });
            // Resume parsing after error
            parser.resume();
        });
        parser.on('end', () => {
            logger_1.log.info('XML parsing complete', {
                total_scanned: summary.totalRecordsScanned,
                total_matched: summary.totalRecordsMatched,
            });
            resolve(summary);
        });
        fileStream.on('error', (err) => {
            reject(new Error(`Failed to read XML file: ${err.message}`));
        });
        // Start parsing
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