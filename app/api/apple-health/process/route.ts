import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for processing large files

// Create Supabase client inline for this route handler
async function getSupabase() {
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

  try {
    // 1. Create Supabase client with user session
    supabase = await getSupabase()

    // 2. Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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

    // 4. Load the import row (RLS ensures user can only see their own)
    const { data: importRow, error: importError } = await supabase
      .from('apple_health_imports')
      .select('id, user_id, file_path')
      .eq('id', importId)
      .single()

    if (importError || !importRow) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // 5. Update status to processing
    await supabase
      .from('apple_health_imports')
      .update({ status: 'processing', error_message: null })
      .eq('id', importId)

    // 6. Download ZIP from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('apple_health_uploads')
      .download(importRow.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message || 'No data'}`)
    }

    // 7. Unzip and find export.xml
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer())
    let xmlContent: string | null = null

    // Try common paths
    for (const path of ['apple_health_export/export.xml', 'export.xml']) {
      const file = zip.file(path)
      if (file) {
        xmlContent = await file.async('string')
        break
      }
    }

    // Fallback: case-insensitive search
    if (!xmlContent) {
      for (const name of Object.keys(zip.files)) {
        if (name.toLowerCase().endsWith('export.xml')) {
          const file = zip.file(name)
          if (file) {
            xmlContent = await file.async('string')
            break
          }
        }
      }
    }

    if (!xmlContent) {
      throw new Error('export.xml not found in Apple Health export')
    }

    // 8. Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    })
    const parsed = parser.parse(xmlContent)

    // Extract Record elements
    let rawRecords = parsed?.HealthData?.Record || []
    if (!Array.isArray(rawRecords)) {
      rawRecords = rawRecords ? [rawRecords] : []
    }

    // Filter to types we care about and normalize
    const relevantTypes: Set<string> = new Set(Object.values(APPLE_TYPES))
    const records: AppleRecord[] = rawRecords
      .filter((r: Record<string, unknown>) => relevantTypes.has(r.type as string))
      .map((r: Record<string, unknown>) => ({
        type: r.type as string,
        value: r.value as string | undefined,
        startDate: r.startDate as string | undefined,
        endDate: r.endDate as string | undefined,
      }))

    // 9. Aggregate metrics
    const aggregated = aggregateAll(records)

    if (aggregated.length === 0) {
      // No metrics found, mark as completed
      await supabase
        .from('apple_health_imports')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', importId)
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

    // 11. Build rows to insert
    const rows = aggregated
      .filter(m => codeToId.has(m.metricCode))
      .map(m => ({
        user_id: importRow.user_id,
        metric_id: codeToId.get(m.metricCode)!,
        value: m.value,
        measured_at: m.measuredAt.toISOString(),
        source: 'apple_health',
      }))

    // 12. Insert rows
    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('eden_metric_values')
        .insert(rows)

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`)
      }
    }

    // 13. Mark as completed
    await supabase
      .from('apple_health_imports')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('id', importId)

    return NextResponse.json({ importedCount: rows.length })

  } catch (err) {
    console.error('Apple Health processing error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const truncated = message.substring(0, 500)

    // Try to mark import as failed
    if (supabase && importId) {
      try {
        await supabase
          .from('apple_health_imports')
          .update({ status: 'failed', error_message: truncated })
          .eq('id', importId)
      } catch (updateErr) {
        console.error('Failed to update import status:', updateErr)
      }
    }

    return NextResponse.json({ error: truncated }, { status: 500 })
  }
}
