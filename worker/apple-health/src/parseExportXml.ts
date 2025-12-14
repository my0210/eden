/**
 * Stream-parse Apple Health Export.xml
 * 
 * Uses SAX parser to stream through the XML without loading it into memory.
 * Accepts a Readable stream (from ZIP entry) - no temp files needed.
 * 
 * Handles:
 * - Direct metrics (vo2max, resting_hr, hrv, body_mass, body_fat)
 * - Sleep aggregation (7-day average)
 * - Blood pressure pairing (systolic + diastolic)
 */

import { Readable } from 'stream'
import * as sax from 'sax'
import { log } from './logger'
import { MetricCode, getAllHkTypes, buildHkTypeToMappingLookup } from './mapping'
import { SleepRecord, aggregateSleep } from './aggregateSleep'
import { BpRecord, pairBloodPressure } from './pairBloodPressure'

/**
 * Metric row ready for DB insert
 */
export interface MetricRow {
  metric_code: MetricCode | string  // Allow string for new codes
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
  rows: MetricRow[]
}

// HK types for direct metric persistence (not aggregated)
const DIRECT_PERSIST_HK_TYPES = new Set([
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
])

// Map HK types to specific DB metric codes
const HK_TO_DB_METRIC_CODE: Record<string, string> = {
  'HKQuantityTypeIdentifierVO2Max': 'vo2max',
  'HKQuantityTypeIdentifierRestingHeartRate': 'resting_hr',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
  'HKQuantityTypeIdentifierBodyMass': 'body_mass',
  'HKQuantityTypeIdentifierBodyFatPercentage': 'body_fat_percentage',
}

/**
 * Parse Export.xml from a readable stream
 * 
 * Streams directly from the ZIP entry - no temp files needed.
 * Memory-safe: uses SAX streaming parser, doesn't buffer the whole XML.
 * 
 * Handles aggregation for sleep and blood pressure after streaming completes.
 * 
 * @param xmlStream - Readable stream of Export.xml content
 * @returns ParseResult with summary and metric rows for persistence
 */
export function parseExportXmlStream(xmlStream: Readable): Promise<ParseResult> {
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

    // Direct metric rows (vo2max, resting_hr, hrv, body_mass, body_fat)
    const directRows: MetricRow[] = []
    
    // Records for aggregation
    const sleepRecords: SleepRecord[] = []
    const bpRecords: BpRecord[] = []
    
    const startTime = Date.now()
    let lastProgressLog = startTime

    // Initialize byMetricCode for all mapped metrics
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

    const LOG_EVERY_N = 100000
    const PROGRESS_LOG_INTERVAL_MS = 30000

    parser.on('opentag', (node: sax.Tag) => {
      if (node.name !== 'Record') return

      summary.totalRecordsScanned++

      // Periodic progress logging
      const now = Date.now()
      if (summary.totalRecordsScanned % LOG_EVERY_N === 0 || now - lastProgressLog > PROGRESS_LOG_INTERVAL_MS) {
        const elapsedSec = Math.round((now - startTime) / 1000)
        log.info('Parse progress', {
          records_scanned: summary.totalRecordsScanned,
          records_matched: summary.totalRecordsMatched,
          direct_rows: directRows.length,
          sleep_records: sleepRecords.length,
          bp_records: bpRecords.length,
          elapsed_sec: elapsedSec,
          rate_per_sec: Math.round(summary.totalRecordsScanned / Math.max(1, elapsedSec)),
        })
        lastProgressLog = now
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

      // === ROUTE RECORDS BY TYPE ===

      // Sleep: collect for aggregation
      if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        if (value) {
          summary.sleepCategories[value] = (summary.sleepCategories[value] || 0) + 1
        }
        if (startDate && endDate && value) {
          sleepRecords.push({
            value,
            startDate,
            endDate,
          })
        }
        return
      }

      // Blood Pressure: collect for pairing
      if (type === 'HKQuantityTypeIdentifierBloodPressureSystolic') {
        summary.bloodPressure.systolicCount++
        if (value && endDate) {
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            bpRecords.push({ type: 'systolic', value: numValue, endDate })
          }
        }
        return
      }
      if (type === 'HKQuantityTypeIdentifierBloodPressureDiastolic') {
        summary.bloodPressure.diastolicCount++
        if (value && endDate) {
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            bpRecords.push({ type: 'diastolic', value: numValue, endDate })
          }
        }
        return
      }

      // Body composition tracking
      if (type === 'HKQuantityTypeIdentifierBodyMass') {
        summary.bodyComposition.bodyMassCount++
      } else if (type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
        summary.bodyComposition.bodyFatCount++
      } else if (type === 'HKQuantityTypeIdentifierLeanBodyMass') {
        summary.bodyComposition.leanBodyMassCount++
      }

      // Direct persist metrics: emit row immediately
      if (DIRECT_PERSIST_HK_TYPES.has(type) && value && (endDate || startDate)) {
        const dbMetricCode = HK_TO_DB_METRIC_CODE[type]
        if (dbMetricCode) {
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            directRows.push({
              metric_code: dbMetricCode as MetricCode,
              value_raw: numValue,
              unit: unit || '',
              measured_at: endDate || startDate,
              source: 'apple_health',
            })
          }
        }
      }
    })

    parser.on('error', (err: Error) => {
      summary.errors.push(err.message)
      log.warn('SAX parser error (continuing)', { error: err.message })
      parser.resume()
    })

    parser.on('end', () => {
      const parseTime = Date.now() - startTime
      
      log.info('XML streaming complete, running aggregations', {
        total_scanned: summary.totalRecordsScanned,
        total_matched: summary.totalRecordsMatched,
        direct_rows: directRows.length,
        sleep_records: sleepRecords.length,
        bp_records: bpRecords.length,
        parse_time_sec: Math.round(parseTime / 1000),
      })

      // Run aggregations
      const sleepRows = aggregateSleep(sleepRecords)
      const bpRows = pairBloodPressure(bpRecords)

      // Combine all rows
      const allRows = [...directRows, ...sleepRows, ...bpRows]

      const totalTime = Math.round((Date.now() - startTime) / 1000)
      log.info('Parse and aggregation complete', {
        total_scanned: summary.totalRecordsScanned,
        total_matched: summary.totalRecordsMatched,
        direct_rows: directRows.length,
        sleep_rows: sleepRows.length,
        bp_rows: bpRows.length,
        total_rows: allRows.length,
        total_time_sec: totalTime,
      })
      
      resolve({ summary, rows: allRows })
    })

    xmlStream.on('error', (err: Error) => {
      reject(new Error(`Stream error while parsing XML: ${err.message}`))
    })

    // Pipe the stream to the SAX parser
    xmlStream.pipe(parser)
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

// Legacy export for backwards compatibility
export { parseExportXmlStream as parseExportXml }
