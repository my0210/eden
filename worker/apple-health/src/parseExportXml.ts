/**
 * Stream-parse Apple Health export.xml
 * 
 * Uses SAX parser to stream through the XML without loading it all into memory.
 * Extracts records matching our mapped HK types and emits metric rows for DB insert.
 */

import * as fs from 'fs'
import * as sax from 'sax'
import { log } from './logger'
import { MetricCode, getAllHkTypes, buildHkTypeToMappingLookup } from './mapping'

/**
 * Metric row ready for DB insert
 */
export interface MetricRow {
  metric_code: MetricCode
  value_raw: number
  unit: string
  measured_at: string  // ISO string
  source: 'apple_health'
}

/**
 * Summary of parsed metrics
 */
export interface ParseSummary {
  totalRecordsScanned: number
  totalRecordsMatched: number
  byMetricCode: Record<string, {
    hkType: string
    count: number
    newestTimestamp: string | null
    oldestTimestamp: string | null
    sampleValues: string[]
  }>
  // Special tracking for complex types
  sleepCategories: Record<string, number>
  bloodPressure: {
    systolicCount: number
    diastolicCount: number
  }
  bodyComposition: {
    bodyMassCount: number
    bodyFatCount: number
    leanBodyMassCount: number
  }
  errors: string[]
}

/**
 * Parse result with both summary and rows
 */
export interface ParseResult {
  summary: ParseSummary
  /** Metric rows ready for DB insert (vo2max, resting_hr, hrv, body_mass, body_fat_percentage) */
  rows: MetricRow[]
}

// HK types we'll persist to eden_metric_values
// Sleep and blood_pressure are log-only until we implement proper aggregation
const PERSIST_HK_TYPES = new Set([
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
])

// Map HK types to our canonical metric codes
const HK_TO_METRIC_CODE: Record<string, MetricCode> = {
  'HKQuantityTypeIdentifierVO2Max': 'vo2max',
  'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
  'HKQuantityTypeIdentifierBodyMass': 'body_composition',  // Will be mapped to body_mass in DB
  'HKQuantityTypeIdentifierBodyFatPercentage': 'body_composition', // Will be mapped to body_fat_percentage
}

// Map HK types to specific DB metric codes (more granular than the canonical)
const HK_TO_DB_METRIC_CODE: Record<string, string> = {
  'HKQuantityTypeIdentifierVO2Max': 'vo2max',
  'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
  'HKQuantityTypeIdentifierBodyMass': 'body_mass',
  'HKQuantityTypeIdentifierBodyFatPercentage': 'body_fat_percentage',
}

/**
 * Parse export.xml and extract metrics
 * 
 * @param xmlPath - Path to the extracted export.xml
 * @param onRowsBatch - Optional callback for streaming writes (called with batches of rows)
 * @returns ParseResult with summary and all rows
 */
export function parseExportXml(
  xmlPath: string,
  onRowsBatch?: (rows: MetricRow[]) => Promise<void>
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const relevantHkTypes = getAllHkTypes()
    const hkTypeToMapping = buildHkTypeToMappingLookup()
    
    const summary: ParseSummary = {
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
    }

    const allRows: MetricRow[] = []
    let rowBuffer: MetricRow[] = []
    const BUFFER_SIZE = 1000  // Flush to callback every 1000 rows

    // Initialize byMetricCode for all our mapped metrics
    for (const [hkType, mapping] of hkTypeToMapping) {
      if (!summary.byMetricCode[mapping.metric_code]) {
        summary.byMetricCode[mapping.metric_code] = {
          hkType: hkType,
          count: 0,
          newestTimestamp: null,
          oldestTimestamp: null,
          sampleValues: [],
        }
      }
    }

    const parser = sax.createStream(true, { trim: true })
    const fileStream = fs.createReadStream(xmlPath, { encoding: 'utf8' })

    const LOG_EVERY_N = 100000

    const flushBuffer = async () => {
      if (rowBuffer.length > 0 && onRowsBatch) {
        await onRowsBatch(rowBuffer)
        rowBuffer = []
      }
    }

    parser.on('opentag', (node: sax.Tag) => {
      if (node.name !== 'Record') return

      summary.totalRecordsScanned++

      if (summary.totalRecordsScanned % LOG_EVERY_N === 0) {
        log.debug('Parse progress', {
          records_scanned: summary.totalRecordsScanned,
          records_matched: summary.totalRecordsMatched,
          rows_collected: allRows.length,
        })
      }

      const attrs = node.attributes as Record<string, string>
      const type = attrs.type
      const value = attrs.value
      const unit = attrs.unit
      const endDate = attrs.endDate
      const startDate = attrs.startDate

      if (!type || !relevantHkTypes.has(type)) {
        return
      }

      summary.totalRecordsMatched++

      const mapping = hkTypeToMapping.get(type)
      if (!mapping) return

      const metricCode = mapping.metric_code
      const metricSummary = summary.byMetricCode[metricCode]
      
      if (metricSummary) {
        metricSummary.count++
        
        const timestamp = endDate || startDate
        if (timestamp) {
          if (!metricSummary.newestTimestamp || timestamp > metricSummary.newestTimestamp) {
            metricSummary.newestTimestamp = timestamp
          }
          if (!metricSummary.oldestTimestamp || timestamp < metricSummary.oldestTimestamp) {
            metricSummary.oldestTimestamp = timestamp
          }
        }

        if (metricSummary.sampleValues.length < 5 && value) {
          metricSummary.sampleValues.push(`${value} ${unit || ''}`.trim())
        }
      }

      // Special tracking
      if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && value) {
        summary.sleepCategories[value] = (summary.sleepCategories[value] || 0) + 1
      }
      if (type === 'HKQuantityTypeIdentifierBloodPressureSystolic') {
        summary.bloodPressure.systolicCount++
      } else if (type === 'HKQuantityTypeIdentifierBloodPressureDiastolic') {
        summary.bloodPressure.diastolicCount++
      }
      if (type === 'HKQuantityTypeIdentifierBodyMass') {
        summary.bodyComposition.bodyMassCount++
      } else if (type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
        summary.bodyComposition.bodyFatCount++
      } else if (type === 'HKQuantityTypeIdentifierLeanBodyMass') {
        summary.bodyComposition.leanBodyMassCount++
      }

      // === EMIT ROW FOR PERSISTENCE ===
      // Only for types we want to persist (not sleep/BP yet)
      if (PERSIST_HK_TYPES.has(type) && value && (endDate || startDate)) {
        const dbMetricCode = HK_TO_DB_METRIC_CODE[type]
        if (dbMetricCode) {
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            const row: MetricRow = {
              metric_code: dbMetricCode as MetricCode,
              value_raw: numValue,
              unit: unit || '',
              measured_at: endDate || startDate,
              source: 'apple_health',
            }
            
            allRows.push(row)
            rowBuffer.push(row)
          }
        }
      }
    })

    parser.on('error', (err: Error) => {
      summary.errors.push(err.message)
      log.warn('SAX parser error (continuing)', { error: err.message })
      parser.resume()
    })

    parser.on('end', async () => {
      try {
        // Flush any remaining rows
        await flushBuffer()
        
        log.info('XML parsing complete', {
          total_scanned: summary.totalRecordsScanned,
          total_matched: summary.totalRecordsMatched,
          rows_to_insert: allRows.length,
        })
        
        resolve({ summary, rows: allRows })
      } catch (err) {
        reject(err)
      }
    })

    fileStream.on('error', (err: Error) => {
      reject(new Error(`Failed to read XML file: ${err.message}`))
    })

    fileStream.pipe(parser)
  })
}

/**
 * Format parse summary for logging
 */
export function formatParseSummaryForLog(summary: ParseSummary): Record<string, unknown> {
  const metrics: Record<string, unknown> = {}
  
  for (const [code, data] of Object.entries(summary.byMetricCode)) {
    if (data.count > 0) {
      metrics[code] = {
        count: data.count,
        newest: data.newestTimestamp,
        samples: data.sampleValues,
      }
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
  }
}
