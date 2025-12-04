import { createRouteHandlerClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

// Apple Health record types we care about
const APPLE_HEALTH_TYPES = {
  VO2_MAX: 'HKQuantityTypeIdentifierVO2Max',
  RESTING_HR: 'HKQuantityTypeIdentifierRestingHeartRate',
  HRV: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  BP_SYSTOLIC: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  BP_DIASTOLIC: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  BODY_FAT: 'HKQuantityTypeIdentifierBodyFatPercentage',
  SLEEP: 'HKCategoryTypeIdentifierSleepAnalysis',
} as const

// Eden metric codes we map to
const EDEN_METRIC_CODES = [
  'vo2max',
  'blood_pressure',
  'resting_hr_and_recovery',
  'body_composition',
  'hrv',
  'sleep_efficiency_and_duration',
] as const

interface AppleHealthRecord {
  type: string
  value?: string
  startDate?: string
  endDate?: string
  unit?: string
}

interface AggregatedMetric {
  metricCode: string
  value: number
  measuredAt: Date
}

// Parse Apple Health date string to Date
function parseAppleDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

// Get the latest record by startDate (or endDate as fallback)
function getLatestRecord(records: AppleHealthRecord[]): AppleHealthRecord | null {
  if (records.length === 0) return null
  
  return records.reduce((latest, current) => {
    const latestDate = parseAppleDate(latest.startDate) || parseAppleDate(latest.endDate)
    const currentDate = parseAppleDate(current.startDate) || parseAppleDate(current.endDate)
    
    if (!latestDate) return current
    if (!currentDate) return latest
    
    return currentDate > latestDate ? current : latest
  })
}

// Aggregate VO2 Max
function aggregateVO2Max(records: AppleHealthRecord[]): AggregatedMetric | null {
  const vo2Records = records.filter(r => r.type === APPLE_HEALTH_TYPES.VO2_MAX)
  const latest = getLatestRecord(vo2Records)
  
  if (!latest || !latest.value) return null
  
  const value = parseFloat(latest.value)
  if (isNaN(value)) return null
  
  const measuredAt = parseAppleDate(latest.startDate) || parseAppleDate(latest.endDate)
  if (!measuredAt) return null
  
  return { metricCode: 'vo2max', value, measuredAt }
}

// Aggregate Resting Heart Rate
function aggregateRestingHR(records: AppleHealthRecord[]): AggregatedMetric | null {
  const hrRecords = records.filter(r => r.type === APPLE_HEALTH_TYPES.RESTING_HR)
  const latest = getLatestRecord(hrRecords)
  
  if (!latest || !latest.value) return null
  
  const value = parseFloat(latest.value)
  if (isNaN(value)) return null
  
  const measuredAt = parseAppleDate(latest.startDate) || parseAppleDate(latest.endDate)
  if (!measuredAt) return null
  
  return { metricCode: 'resting_hr_and_recovery', value, measuredAt }
}

// Aggregate Blood Pressure (systolic only)
function aggregateBloodPressure(records: AppleHealthRecord[]): AggregatedMetric | null {
  const systolicRecords = records.filter(r => r.type === APPLE_HEALTH_TYPES.BP_SYSTOLIC)
  const diastolicRecords = records.filter(r => r.type === APPLE_HEALTH_TYPES.BP_DIASTOLIC)
  
  if (systolicRecords.length === 0) return null
  
  // Build pairs where timestamps match within 60 seconds
  const pairs: { systolic: AppleHealthRecord; diastolic: AppleHealthRecord | null; date: Date }[] = []
  
  for (const sys of systolicRecords) {
    const sysDate = parseAppleDate(sys.startDate)
    if (!sysDate) continue
    
    // Find matching diastolic within 60 seconds
    const matchingDia = diastolicRecords.find(dia => {
      const diaDate = parseAppleDate(dia.startDate)
      if (!diaDate) return false
      return Math.abs(sysDate.getTime() - diaDate.getTime()) <= 60000
    })
    
    pairs.push({ systolic: sys, diastolic: matchingDia || null, date: sysDate })
  }
  
  if (pairs.length === 0) return null
  
  // Get the latest pair
  const latestPair = pairs.reduce((latest, current) => 
    current.date > latest.date ? current : latest
  )
  
  const value = parseFloat(latestPair.systolic.value || '')
  if (isNaN(value)) return null
  
  return { metricCode: 'blood_pressure', value, measuredAt: latestPair.date }
}

// Aggregate Body Composition (body fat %)
function aggregateBodyComposition(records: AppleHealthRecord[]): AggregatedMetric | null {
  const bodyFatRecords = records.filter(r => r.type === APPLE_HEALTH_TYPES.BODY_FAT)
  const latest = getLatestRecord(bodyFatRecords)
  
  if (!latest || !latest.value) return null
  
  let value = parseFloat(latest.value)
  if (isNaN(value)) return null
  
  // Apple Health might store as decimal (0.18) or percentage (18.0)
  // If value is less than 1, multiply by 100
  if (value < 1) {
    value = value * 100
  }
  
  const measuredAt = parseAppleDate(latest.startDate) || parseAppleDate(latest.endDate)
  if (!measuredAt) return null
  
  return { metricCode: 'body_composition', value, measuredAt }
}

// Aggregate HRV
function aggregateHRV(records: AppleHealthRecord[]): AggregatedMetric | null {
  const hrvRecords = records.filter(r => r.type === APPLE_HEALTH_TYPES.HRV)
  const latest = getLatestRecord(hrvRecords)
  
  if (!latest || !latest.value) return null
  
  const value = parseFloat(latest.value)
  if (isNaN(value)) return null
  
  const measuredAt = parseAppleDate(latest.startDate) || parseAppleDate(latest.endDate)
  if (!measuredAt) return null
  
  return { metricCode: 'hrv', value, measuredAt }
}

// Aggregate Sleep Duration
function aggregateSleep(records: AppleHealthRecord[]): AggregatedMetric | null {
  // Filter for asleep records only
  const sleepRecords = records.filter(r => 
    r.type === APPLE_HEALTH_TYPES.SLEEP && 
    r.value === 'HKCategoryValueSleepAnalysisAsleep'
  )
  
  if (sleepRecords.length === 0) return null
  
  // Group by sleep day (date of endDate)
  const sleepByDay = new Map<string, { totalHours: number; latestEnd: Date }>()
  
  for (const rec of sleepRecords) {
    const startDate = parseAppleDate(rec.startDate)
    const endDate = parseAppleDate(rec.endDate)
    
    if (!startDate || !endDate) continue
    
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
    if (hours <= 0 || hours > 24) continue // Sanity check
    
    // Use end date's local date as sleep day (YYYY-MM-DD)
    const sleepDay = endDate.toISOString().split('T')[0]
    
    const existing = sleepByDay.get(sleepDay)
    if (existing) {
      existing.totalHours += hours
      if (endDate > existing.latestEnd) {
        existing.latestEnd = endDate
      }
    } else {
      sleepByDay.set(sleepDay, { totalHours: hours, latestEnd: endDate })
    }
  }
  
  if (sleepByDay.size === 0) return null
  
  // Find the latest sleep day
  let latestDay: string | null = null
  let latestData: { totalHours: number; latestEnd: Date } | null = null
  
  for (const [day, data] of sleepByDay) {
    if (!latestDay || day > latestDay) {
      latestDay = day
      latestData = data
    }
  }
  
  if (!latestData) return null
  
  return {
    metricCode: 'sleep_efficiency_and_duration',
    value: Math.round(latestData.totalHours * 10) / 10, // Round to 1 decimal
    measuredAt: latestData.latestEnd,
  }
}

// Main aggregation function
function aggregateMetrics(records: AppleHealthRecord[]): AggregatedMetric[] {
  const results: AggregatedMetric[] = []
  
  const vo2 = aggregateVO2Max(records)
  if (vo2) results.push(vo2)
  
  const hr = aggregateRestingHR(records)
  if (hr) results.push(hr)
  
  const bp = aggregateBloodPressure(records)
  if (bp) results.push(bp)
  
  const bodyComp = aggregateBodyComposition(records)
  if (bodyComp) results.push(bodyComp)
  
  const hrv = aggregateHRV(records)
  if (hrv) results.push(hrv)
  
  const sleep = aggregateSleep(records)
  if (sleep) results.push(sleep)
  
  return results
}

export async function POST(request: Request) {
  let supabase;
  let importId: string | null = null
  
  try {
    // Create authenticated Supabase client using the user's session (respects RLS)
    supabase = await createRouteHandlerClient()
  } catch (clientError) {
    console.error('Failed to create Supabase client:', clientError)
    return NextResponse.json(
      { error: 'Failed to initialize database connection' },
      { status: 500 }
    )
  }
  
  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  try {
    // Parse request body
    const body = await request.json()
    importId = body.importId as string | null
    
    if (!importId) {
      return NextResponse.json({ error: 'importId is required' }, { status: 400 })
    }
    
    // Mark import as processing
    // RLS ensures user can only update their own imports
    const { error: updateProcessingError } = await supabase
      .from('apple_health_imports')
      .update({ status: 'processing' })
      .eq('id', importId)
    
    if (updateProcessingError) {
      throw new Error(`Failed to update import status: ${updateProcessingError.message}`)
    }
    
    // Load the import row
    // RLS ensures user can only read their own imports
    const { data: importRow, error: importError } = await supabase
      .from('apple_health_imports')
      .select('user_id, file_path')
      .eq('id', importId)
      .single()
    
    if (importError || !importRow) {
      throw new Error(`Failed to load import: ${importError?.message || 'Not found'}`)
    }
    
    const { user_id, file_path } = importRow
    
    // Verify the import belongs to the authenticated user
    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Download the zip file from storage
    // RLS on the bucket ensures user can only access their own files
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('apple_health_uploads')
      .download(file_path)
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'No data'}`)
    }
    
    // Unzip the file
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer())
    
    // Find the export.xml file (could be at root or in apple_health_export folder)
    let xmlContent: string | null = null
    const possiblePaths = ['export.xml', 'apple_health_export/export.xml']
    
    for (const path of possiblePaths) {
      const file = zip.file(path)
      if (file) {
        xmlContent = await file.async('string')
        break
      }
    }
    
    // Also try case-insensitive search
    if (!xmlContent) {
      const files = Object.keys(zip.files)
      for (const fileName of files) {
        if (fileName.toLowerCase().endsWith('export.xml')) {
          const file = zip.file(fileName)
          if (file) {
            xmlContent = await file.async('string')
            break
          }
        }
      }
    }
    
    if (!xmlContent) {
      throw new Error('export.xml not found in zip file')
    }
    
    // Parse the XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    })
    
    const parsed = parser.parse(xmlContent)
    
    // Extract records - they're usually in HealthData.Record
    let rawRecords = parsed?.HealthData?.Record || []
    
    // Ensure it's an array
    if (!Array.isArray(rawRecords)) {
      rawRecords = rawRecords ? [rawRecords] : []
    }
    
    // Filter to only the types we care about
    const relevantTypes: Set<string> = new Set(Object.values(APPLE_HEALTH_TYPES))
    const records: AppleHealthRecord[] = rawRecords
      .filter((r: Record<string, unknown>) => relevantTypes.has(r.type as string))
      .map((r: Record<string, unknown>) => ({
        type: r.type as string,
        value: r.value as string | undefined,
        startDate: r.startDate as string | undefined,
        endDate: r.endDate as string | undefined,
        unit: r.unit as string | undefined,
      }))
    
    // Aggregate metrics
    const aggregatedMetrics = aggregateMetrics(records)
    
    if (aggregatedMetrics.length === 0) {
      // No metrics to insert, mark as completed
      await supabase
        .from('apple_health_imports')
        .update({ 
          status: 'completed', 
          processed_at: new Date().toISOString() 
        })
        .eq('id', importId)
      
      return NextResponse.json({ importedCount: 0 })
    }
    
    // Load metric definitions for the codes we need
    const metricCodes = aggregatedMetrics.map(m => m.metricCode)
    const { data: metricDefs, error: metricDefsError } = await supabase
      .from('eden_metric_definitions')
      .select('id, metric_code')
      .in('metric_code', metricCodes)
    
    if (metricDefsError) {
      throw new Error(`Failed to load metric definitions: ${metricDefsError.message}`)
    }
    
    // Build a map of metric_code -> id
    const metricCodeToId = new Map<string, string>()
    for (const def of metricDefs || []) {
      metricCodeToId.set(def.metric_code, def.id)
    }
    
    // Build the rows to insert
    // Use the authenticated user's ID to ensure RLS allows the insert
    const rowsToInsert = aggregatedMetrics
      .filter(m => metricCodeToId.has(m.metricCode))
      .map(m => ({
        user_id: user.id, // Use authenticated user's ID
        metric_id: metricCodeToId.get(m.metricCode)!,
        value: m.value,
        measured_at: m.measuredAt.toISOString(),
        source: 'apple_health',
      }))
    
    if (rowsToInsert.length === 0) {
      // No valid rows to insert
      await supabase
        .from('apple_health_imports')
        .update({ 
          status: 'completed', 
          processed_at: new Date().toISOString() 
        })
        .eq('id', importId)
      
      return NextResponse.json({ importedCount: 0 })
    }
    
    // Insert the metric values
    // RLS policy: auth.uid() = user_id allows insert
    const { error: insertError } = await supabase
      .from('eden_metric_values')
      .insert(rowsToInsert)
    
    if (insertError) {
      throw new Error(`Failed to insert metric values: ${insertError.message}`)
    }
    
    // Mark as completed
    await supabase
      .from('apple_health_imports')
      .update({ 
        status: 'completed', 
        processed_at: new Date().toISOString() 
      })
      .eq('id', importId)
    
    return NextResponse.json({ importedCount: rowsToInsert.length })
    
  } catch (error) {
    console.error('Apple Health processing error:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message.substring(0, 500) 
      : 'Unknown error'
    
    // If we have an importId, mark it as failed
    if (importId) {
      try {
        await supabase
          .from('apple_health_imports')
          .update({ 
            status: 'failed', 
            error_message: errorMessage 
          })
          .eq('id', importId)
      } catch (updateErr) {
        console.error('Failed to update import status to failed:', updateErr)
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
