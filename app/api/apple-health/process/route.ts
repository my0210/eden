import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for processing large files

// Create Supabase client inline for this route handler
async function getSupabase(req: NextRequest) {
  // Check if this is a cron job call
  const isCronJob = req.headers.get('x-cron-job') === 'true'
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Verify cron secret if this is a cron job call
  if (isCronJob) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw new Error('Invalid cron secret')
    }
    
    // Use anon key for cron job calls (with database functions that bypass RLS)
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  
  // Normal user session-based client
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookies might be read-only
          }
        },
      },
    }
  )
}

// Apple Health record types we map to Eden metrics
// NOTE: The canonical mapping is defined in lib/prime-scorecard/mapping.ts
// This local copy exists for the current parser implementation.
// Future: Refactor to use appleHealthMappings from the prime-scorecard module.
const APPLE_TYPES = {
  VO2_MAX: 'HKQuantityTypeIdentifierVO2Max',
  RESTING_HR: 'HKQuantityTypeIdentifierRestingHeartRate',
  HRV: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  BP_SYSTOLIC: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  BP_DIASTOLIC: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  BODY_FAT: 'HKQuantityTypeIdentifierBodyFatPercentage',
  SLEEP: 'HKCategoryTypeIdentifierSleepAnalysis',
} as const

// Eden metric codes
// NOTE: The canonical metric codes are defined in lib/prime-scorecard/metrics.ts
// This local mapping uses legacy codes that differ slightly from canonical codes.
// Future: Migrate to canonical codes from the prime-scorecard module.
const EDEN_CODES = [
  'vo2max',
  'resting_hr_and_recovery',
  'blood_pressure',
  'body_composition',
  'hrv',
  'sleep_efficiency_and_duration',
] as const

interface AppleRecord {
  type: string
  value?: string
  startDate?: string
  endDate?: string
}

interface AggregatedMetric {
  metricCode: string
  value: number
  measuredAt: Date
}

// Parse date string to Date, return null if invalid
function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Get latest record by startDate (fallback to endDate)
function getLatest(records: AppleRecord[]): AppleRecord | null {
  if (!records.length) return null
  return records.reduce((best, cur) => {
    const bestDate = parseDate(best.startDate) || parseDate(best.endDate)
    const curDate = parseDate(cur.startDate) || parseDate(cur.endDate)
    if (!bestDate) return cur
    if (!curDate) return best
    return curDate > bestDate ? cur : best
  })
}

// Aggregate VO2Max
function aggregateVO2Max(records: AppleRecord[]): AggregatedMetric | null {
  const filtered = records.filter(r => r.type === APPLE_TYPES.VO2_MAX)
  const latest = getLatest(filtered)
  if (!latest?.value) return null
  const value = parseFloat(latest.value)
  if (isNaN(value)) return null
  const measuredAt = parseDate(latest.startDate) || parseDate(latest.endDate)
  if (!measuredAt) return null
  return { metricCode: 'vo2max', value, measuredAt }
}

// Aggregate Resting HR
function aggregateRestingHR(records: AppleRecord[]): AggregatedMetric | null {
  const filtered = records.filter(r => r.type === APPLE_TYPES.RESTING_HR)
  const latest = getLatest(filtered)
  if (!latest?.value) return null
  const value = parseFloat(latest.value)
  if (isNaN(value)) return null
  const measuredAt = parseDate(latest.startDate) || parseDate(latest.endDate)
  if (!measuredAt) return null
  return { metricCode: 'resting_hr_and_recovery', value, measuredAt }
}

// Aggregate Blood Pressure (systolic only, paired with diastolic)
function aggregateBP(records: AppleRecord[]): AggregatedMetric | null {
  const systolic = records.filter(r => r.type === APPLE_TYPES.BP_SYSTOLIC)
  const diastolic = records.filter(r => r.type === APPLE_TYPES.BP_DIASTOLIC)
  if (!systolic.length) return null

  const pairs: { sys: AppleRecord; date: Date }[] = []
  for (const sys of systolic) {
    const sysDate = parseDate(sys.startDate)
    if (!sysDate) continue
    // Find matching diastolic within 60 seconds
    const match = diastolic.find(dia => {
      const diaDate = parseDate(dia.startDate)
      return diaDate && Math.abs(sysDate.getTime() - diaDate.getTime()) <= 60000
    })
    if (match) {
      pairs.push({ sys, date: sysDate })
    }
  }

  if (!pairs.length) return null
  const latestPair = pairs.reduce((best, cur) => cur.date > best.date ? cur : best)
  const value = parseFloat(latestPair.sys.value || '')
  if (isNaN(value)) return null
  return { metricCode: 'blood_pressure', value, measuredAt: latestPair.date }
}

// Aggregate Body Composition (body fat %)
function aggregateBodyFat(records: AppleRecord[]): AggregatedMetric | null {
  const filtered = records.filter(r => r.type === APPLE_TYPES.BODY_FAT)
  const latest = getLatest(filtered)
  if (!latest?.value) return null
  let value = parseFloat(latest.value)
  if (isNaN(value)) return null
  // Convert decimal to percentage if needed (0.18 -> 18)
  if (value < 1) value *= 100
  const measuredAt = parseDate(latest.startDate) || parseDate(latest.endDate)
  if (!measuredAt) return null
  return { metricCode: 'body_composition', value, measuredAt }
}

// Aggregate HRV
function aggregateHRV(records: AppleRecord[]): AggregatedMetric | null {
  const filtered = records.filter(r => r.type === APPLE_TYPES.HRV)
  const latest = getLatest(filtered)
  if (!latest?.value) return null
  const value = parseFloat(latest.value)
  if (isNaN(value)) return null
  const measuredAt = parseDate(latest.startDate) || parseDate(latest.endDate)
  if (!measuredAt) return null
  return { metricCode: 'hrv', value, measuredAt }
}

// Aggregate Sleep Duration
function aggregateSleep(records: AppleRecord[]): AggregatedMetric | null {
  const asleep = records.filter(
    r => r.type === APPLE_TYPES.SLEEP && r.value === 'HKCategoryValueSleepAnalysisAsleep'
  )
  if (!asleep.length) return null

  // Group by sleep day (YYYY-MM-DD of endDate)
  const byDay = new Map<string, { hours: number; latestEnd: Date }>()
  for (const rec of asleep) {
    const start = parseDate(rec.startDate)
    const end = parseDate(rec.endDate)
    if (!start || !end) continue
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    if (hours <= 0 || hours > 24) continue
    const day = end.toISOString().split('T')[0]
    const existing = byDay.get(day)
    if (existing) {
      existing.hours += hours
      if (end > existing.latestEnd) existing.latestEnd = end
    } else {
      byDay.set(day, { hours, latestEnd: end })
    }
  }

  if (!byDay.size) return null

  // Find latest day
  let latestDay = ''
  let latestData: { hours: number; latestEnd: Date } | null = null
  for (const [day, data] of byDay) {
    if (day > latestDay) {
      latestDay = day
      latestData = data
    }
  }

  if (!latestData) return null
  return {
    metricCode: 'sleep_efficiency_and_duration',
    value: Math.round(latestData.hours * 10) / 10,
    measuredAt: latestData.latestEnd,
  }
}

// Run all aggregations
function aggregateAll(records: AppleRecord[]): AggregatedMetric[] {
  const results: AggregatedMetric[] = []
  const vo2 = aggregateVO2Max(records)
  if (vo2) results.push(vo2)
  const hr = aggregateRestingHR(records)
  if (hr) results.push(hr)
  const bp = aggregateBP(records)
  if (bp) results.push(bp)
  const fat = aggregateBodyFat(records)
  if (fat) results.push(fat)
  const hrv = aggregateHRV(records)
  if (hrv) results.push(hrv)
  const sleep = aggregateSleep(records)
  if (sleep) results.push(sleep)
  return results
}

export async function POST(req: NextRequest) {
  let importId: string | null = null
  let supabase: Awaited<ReturnType<typeof getSupabase>> | null = null
  let isCronJob = false

  try {
    // 1. Create Supabase client (handles both user session and cron job)
    isCronJob = req.headers.get('x-cron-job') === 'true'
    supabase = await getSupabase(req)

    // 2. Check authentication
    let userId: string | null = null
    if (isCronJob) {
      // Get user_id from header for cron job calls
      userId = req.headers.get('x-user-id')
      if (!userId) {
        return NextResponse.json({ error: 'x-user-id header required for cron job calls' }, { status: 400 })
      }
    } else {
      // Normal user auth check
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      userId = user.id
    }

    // 3. Parse request body
    let body: { importId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    importId = body.importId || null
    if (!importId) {
      return NextResponse.json({ error: 'importId is required' }, { status: 400 })
    }

    // 4. Load the import row
    // For cron job calls, we use a database function that bypasses RLS
    // For normal calls, RLS ensures user can only see their own
    let importRow: { id: string; user_id: string; file_path: string } | null = null
    
    if (isCronJob) {
      // For cron jobs, use RPC function to get import (bypasses RLS)
      const { data, error: rpcError } = await supabase
        .rpc('get_import_by_id', { import_id: importId })
      
      if (rpcError || !data || data.length === 0) {
        return NextResponse.json({ error: 'Import not found' }, { status: 404 })
      }
      
      importRow = data[0] as { id: string; user_id: string; file_path: string }
    } else {
      // Normal call - RLS handles access control
      const { data, error: importError } = await supabase
        .from('apple_health_imports')
        .select('id, user_id, file_path')
        .eq('id', importId)
        .single()

      if (importError || !data) {
        return NextResponse.json({ error: 'Import not found' }, { status: 404 })
      }
      importRow = data
    }

    // Verify user_id matches (extra check for cron job calls)
    if (isCronJob && importRow.user_id !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 })
    }

    // 5. Update status to processing
    if (isCronJob) {
      // Use RPC function for cron jobs to bypass RLS
      await supabase.rpc('update_import_status', {
        import_id: importId,
        new_status: 'processing',
        error_msg: null,
      })
    } else {
      // Normal update (RLS handles access)
      await supabase
        .from('apple_health_imports')
        .update({ status: 'processing', error_message: null })
        .eq('id', importId)
    }

    // 6. Download ZIP from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('apple_health_uploads')
      .download(importRow.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message || 'No data'}`)
    }

    // Check file size - limit to 50MB to avoid memory issues
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (fileData.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${Math.round(fileData.size / 1024 / 1024)}MB). Maximum supported size is 50MB. Try exporting a shorter date range from Apple Health.`)
    }

    // 7. Unzip and find export.xml
    const zipBuffer = await fileData.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)
    
    // Find export.xml file
    let xmlFile: JSZip.JSZipObject | null = null
    for (const path of ['apple_health_export/export.xml', 'export.xml']) {
      const file = zip.file(path)
      if (file) {
        xmlFile = file
        break
      }
    }

    // Fallback: case-insensitive search
    if (!xmlFile) {
      for (const name of Object.keys(zip.files)) {
        if (name.toLowerCase().endsWith('export.xml')) {
          xmlFile = zip.file(name)
          if (xmlFile) break
        }
      }
    }

    if (!xmlFile) {
      throw new Error('export.xml not found in Apple Health export')
    }

    // Check uncompressed size of export.xml
    const xmlInfo = xmlFile as unknown as { _data?: { uncompressedSize?: number } }
    const uncompressedSize = xmlInfo._data?.uncompressedSize || 0
    if (uncompressedSize > 200 * 1024 * 1024) { // 200MB uncompressed
      throw new Error(`export.xml is too large (${Math.round(uncompressedSize / 1024 / 1024)}MB uncompressed). Try exporting a shorter date range.`)
    }

    const xmlContent = await xmlFile.async('string')

    // 8. Parse XML - only extract Record elements with minimal memory
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      isArray: (name) => name === 'Record', // Ensure Record is always an array
    })
    const parsed = parser.parse(xmlContent)


    // Extract Record elements
    let rawRecords = parsed?.HealthData?.Record || []
    if (!Array.isArray(rawRecords)) {
      rawRecords = rawRecords ? [rawRecords] : []
    }

    // Filter to types we care about IMMEDIATELY to reduce memory
    const relevantTypes: Set<string> = new Set(Object.values(APPLE_TYPES))
    const records: AppleRecord[] = []
    for (const r of rawRecords) {
      if (relevantTypes.has(r.type)) {
        records.push({
          type: r.type,
          value: r.value,
          startDate: r.startDate,
          endDate: r.endDate,
        })
      }
    }
    // Clear rawRecords to free memory
    rawRecords = []

    // 9. Aggregate metrics
    const aggregated = aggregateAll(records)

    if (aggregated.length === 0) {
      // No metrics found, mark as completed
      if (isCronJob) {
        await supabase.rpc('update_import_status', {
          import_id: importId,
          new_status: 'completed',
          processed_at_val: new Date().toISOString(),
        })
      } else {
        await supabase
          .from('apple_health_imports')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', importId)
      }
      return NextResponse.json({ importedCount: 0 })
    }

    // 10. Look up metric definitions
    const codes = aggregated.map(m => m.metricCode)
    const { data: defs, error: defsError } = await supabase
      .from('eden_metric_definitions')
      .select('id, metric_code')
      .in('metric_code', codes)

    if (defsError) {
      throw new Error(`Failed to load definitions: ${defsError.message}`)
    }

    const codeToId = new Map<string, string>()
    for (const d of defs || []) {
      codeToId.set(d.metric_code, d.id)
    }

    // 11. Build rows to insert (with idempotency check)
    const rowsToInsert: Array<{
      user_id: string
      metric_id: string
      value: number
      measured_at: string
      source: string
    }> = []

    for (const m of aggregated) {
      if (!codeToId.has(m.metricCode)) continue
      
      const metricId = codeToId.get(m.metricCode)!
      const measuredAt = m.measuredAt.toISOString()
      
      // Check if this metric value already exists (idempotency)
      const { data: existing } = await supabase
        .from('eden_metric_values')
        .select('id')
        .eq('user_id', importRow.user_id)
        .eq('metric_id', metricId)
        .eq('measured_at', measuredAt)
        .maybeSingle()
      
      if (!existing) {
        rowsToInsert.push({
          user_id: importRow.user_id,
          metric_id: metricId,
          value: m.value,
          measured_at: measuredAt,
          source: 'apple_health',
        })
      }
    }

    // 12. Insert new rows (idempotent - won't duplicate)
    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('eden_metric_values')
        .insert(rowsToInsert)

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`)
      }
    }

    // 13. Mark as completed
    if (isCronJob) {
      await supabase.rpc('update_import_status', {
        import_id: importId,
        new_status: 'completed',
        processed_at_val: new Date().toISOString(),
      })
    } else {
      await supabase
        .from('apple_health_imports')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', importId)
    }

    return NextResponse.json({ importedCount: rowsToInsert.length })

  } catch (err) {
    console.error('Apple Health processing error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const truncated = message.substring(0, 500)

    // Try to mark import as failed
    if (supabase && importId) {
      try {
        const isCronJob = req.headers.get('x-cron-job') === 'true'
        if (isCronJob) {
          await supabase.rpc('update_import_status', {
            import_id: importId,
            new_status: 'failed',
            error_msg: truncated,
          })
        } else {
          await supabase
            .from('apple_health_imports')
            .update({ status: 'failed', error_message: truncated })
            .eq('id', importId)
        }
      } catch (updateErr) {
        console.error('Failed to update import status:', updateErr)
      }
    }

    return NextResponse.json({ error: truncated }, { status: 500 })
  }
}
