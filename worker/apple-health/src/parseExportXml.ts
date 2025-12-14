/**
 * Stream-parse Apple Health export.xml
 * 
 * Uses SAX parser to stream through the XML without loading it all into memory.
 * Extracts records matching our mapped HK types and tracks counts/timestamps.
 */

import * as fs from 'fs'
import * as sax from 'sax'
import { log } from './logger'
import { MetricCode, getAllHkTypes, buildHkTypeToMappingLookup } from './mapping'

/**
 * Parsed record from export.xml
 */
export interface ParsedRecord {
  type: string           // HK type identifier
  value: string          // Value from the record
  unit: string           // Unit of measurement
  startDate: string      // ISO date string
  endDate: string        // ISO date string
  sourceName?: string    // Source app/device name
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
    sampleValues: string[]  // First few values for debugging
  }>
  // Special tracking for complex types
  sleepCategories: Record<string, number>  // e.g., { "HKCategoryValueSleepAnalysisAsleepCore": 1234 }
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
 * Parse export.xml and extract metrics summary
 * 
 * This is a LOG-ONLY pass - no database writes.
 * We're counting records and tracking timestamps.
 * 
 * @param xmlPath - Path to the extracted export.xml
 * @returns Summary of parsed metrics
 */
export function parseExportXml(xmlPath: string): Promise<ParseSummary> {
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

    let recordsLogged = 0
    const LOG_EVERY_N = 100000  // Log progress every 100k records

    parser.on('opentag', (node: sax.Tag) => {
      // We only care about <Record> elements
      if (node.name !== 'Record') return

      summary.totalRecordsScanned++

      // Log progress periodically
      if (summary.totalRecordsScanned % LOG_EVERY_N === 0) {
        log.debug('Parse progress', {
          records_scanned: summary.totalRecordsScanned,
          records_matched: summary.totalRecordsMatched,
        })
      }

      const attrs = node.attributes as Record<string, string>
      const type = attrs.type
      const value = attrs.value
      const unit = attrs.unit
      const endDate = attrs.endDate
      const startDate = attrs.startDate

      // Skip if not a type we care about
      if (!type || !relevantHkTypes.has(type)) {
        return
      }

      summary.totalRecordsMatched++

      // Get the mapping for this HK type
      const mapping = hkTypeToMapping.get(type)
      if (!mapping) return

      const metricCode = mapping.metric_code

      // Update the metric summary
      const metricSummary = summary.byMetricCode[metricCode]
      if (metricSummary) {
        metricSummary.count++
        
        // Track newest/oldest timestamps
        const timestamp = endDate || startDate
        if (timestamp) {
          if (!metricSummary.newestTimestamp || timestamp > metricSummary.newestTimestamp) {
            metricSummary.newestTimestamp = timestamp
          }
          if (!metricSummary.oldestTimestamp || timestamp < metricSummary.oldestTimestamp) {
            metricSummary.oldestTimestamp = timestamp
          }
        }

        // Keep a few sample values for debugging
        if (metricSummary.sampleValues.length < 5 && value) {
          metricSummary.sampleValues.push(`${value} ${unit || ''}`.trim())
        }
      }

      // Special tracking for sleep categories
      if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && value) {
        summary.sleepCategories[value] = (summary.sleepCategories[value] || 0) + 1
      }

      // Special tracking for blood pressure
      if (type === 'HKQuantityTypeIdentifierBloodPressureSystolic') {
        summary.bloodPressure.systolicCount++
      } else if (type === 'HKQuantityTypeIdentifierBloodPressureDiastolic') {
        summary.bloodPressure.diastolicCount++
      }

      // Special tracking for body composition
      if (type === 'HKQuantityTypeIdentifierBodyMass') {
        summary.bodyComposition.bodyMassCount++
      } else if (type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
        summary.bodyComposition.bodyFatCount++
      } else if (type === 'HKQuantityTypeIdentifierLeanBodyMass') {
        summary.bodyComposition.leanBodyMassCount++
      }
    })

    parser.on('error', (err: Error) => {
      // SAX parser errors are often recoverable - log but continue
      summary.errors.push(err.message)
      log.warn('SAX parser error (continuing)', { error: err.message })
      // Resume parsing after error
      parser.resume()
    })

    parser.on('end', () => {
      log.info('XML parsing complete', {
        total_scanned: summary.totalRecordsScanned,
        total_matched: summary.totalRecordsMatched,
      })
      resolve(summary)
    })

    fileStream.on('error', (err: Error) => {
      reject(new Error(`Failed to read XML file: ${err.message}`))
    })

    // Start parsing
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

