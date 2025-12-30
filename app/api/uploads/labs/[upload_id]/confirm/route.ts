import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { NormalizedLabValues } from '@/lib/lab-analysis/types'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ upload_id: string }>
}

interface ConfirmLabUploadRequest {
  normalized_values: NormalizedLabValues
  lab_info?: {
    test_date?: string
    lab_provider?: string
  }
}

function toLabsEntry(
  normalized: NormalizedLabValues,
  uploadId: string,
  labInfo?: { test_date?: string; lab_provider?: string }
): Record<string, unknown> {
  // `LabsEntry` lives in `lib/onboarding/types.ts`, but we keep this as a plain object
  // to avoid server route importing client types in a tight loop.
  const labs: Record<string, unknown> = {
    upload_id: uploadId,
  }

  if (normalized.apob_mg_dl != null) labs.apob_mg_dl = normalized.apob_mg_dl
  if (normalized.hba1c_percent != null) labs.hba1c_percent = normalized.hba1c_percent
  if (normalized.hscrp_mg_l != null) labs.hscrp_mg_l = normalized.hscrp_mg_l

  if (normalized.ldl_mg_dl != null) labs.ldl_mg_dl = normalized.ldl_mg_dl
  if (normalized.hdl_mg_dl != null) labs.hdl_mg_dl = normalized.hdl_mg_dl
  if (normalized.triglycerides_mg_dl != null) labs.triglycerides_mg_dl = normalized.triglycerides_mg_dl
  if (normalized.total_cholesterol_mg_dl != null) labs.total_cholesterol_mg_dl = normalized.total_cholesterol_mg_dl

  if (normalized.fasting_glucose_mg_dl != null) labs.fasting_glucose_mg_dl = normalized.fasting_glucose_mg_dl
  if (normalized.fasting_insulin_uiu_ml != null) labs.fasting_insulin_uiu_ml = normalized.fasting_insulin_uiu_ml

  // PrimeCheck expects liver markers as alt/ast/ggt (U/L)
  if (normalized.alt_u_l != null) labs.alt = normalized.alt_u_l
  if (normalized.ast_u_l != null) labs.ast = normalized.ast_u_l
  if (normalized.ggt_u_l != null) labs.ggt = normalized.ggt_u_l

  if (normalized.egfr != null) labs.egfr = normalized.egfr
  if (normalized.creatinine_mg_dl != null) labs.creatinine_mg_dl = normalized.creatinine_mg_dl
  if (normalized.vitamin_d_ng_ml != null) labs.vitamin_d_ng_ml = normalized.vitamin_d_ng_ml
  if (normalized.vitamin_b12_pg_ml != null) labs.vitamin_b12_pg_ml = normalized.vitamin_b12_pg_ml
  if (normalized.tsh_miu_l != null) labs.tsh_miu_l = normalized.tsh_miu_l

  if (labInfo?.test_date) labs.test_date = labInfo.test_date.substring(0, 7)
  if (labInfo?.lab_provider) labs.lab_provider = labInfo.lab_provider

  return labs
}

/**
 * POST /api/uploads/labs/[upload_id]/confirm
 *
 * Marks a lab upload as confirmed and applies normalized lab values into
 * `eden_user_state.prime_check_json.metabolism.labs` so they impact scoring.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { upload_id } = await context.params

    const body = (await request.json().catch(() => null)) as ConfirmLabUploadRequest | null
    if (!body?.normalized_values) {
      return NextResponse.json({ error: 'normalized_values required' }, { status: 400 })
    }

    // Ensure upload exists and belongs to user
    const { data: upload, error: uploadErr } = await supabase
      .from('eden_lab_uploads')
      .select('id, user_id, status, analysis_metadata')
      .eq('id', upload_id)
      .eq('user_id', user.id)
      .single()

    if (uploadErr || !upload) {
      return NextResponse.json({ error: 'Lab upload not found' }, { status: 404 })
    }

    if (upload.status === 'rejected') {
      return NextResponse.json({ error: 'Lab upload was rejected and cannot be confirmed' }, { status: 400 })
    }

    // Mark upload as confirmed (without changing status enum)
    const nextAnalysisMetadata = {
      ...(upload.analysis_metadata || {}),
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    }

    const { error: updateUploadErr } = await supabase
      .from('eden_lab_uploads')
      .update({
        analysis_metadata: nextAnalysisMetadata,
        lab_date: body.lab_info?.test_date ? body.lab_info.test_date.substring(0, 7) : undefined,
        lab_provider: body.lab_info?.lab_provider ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', upload_id)
      .eq('user_id', user.id)

    if (updateUploadErr) {
      console.error('Error updating lab upload:', updateUploadErr)
      return NextResponse.json({ error: 'Failed to confirm lab upload' }, { status: 500 })
    }

    // Apply into prime_check_json.metabolism.labs
    const { data: userState, error: stateErr } = await supabase
      .from('eden_user_state')
      .select('prime_check_json')
      .eq('user_id', user.id)
      .single()

    if (stateErr) {
      console.error('Error fetching user state:', stateErr)
      return NextResponse.json({ error: 'Failed to load user state' }, { status: 500 })
    }

    const primeCheck = (userState?.prime_check_json || {}) as Record<string, unknown>
    const metabolism = (primeCheck.metabolism || {}) as Record<string, unknown>

    const labs = toLabsEntry(body.normalized_values, upload_id, body.lab_info)

    const { error: updateStateErr } = await supabase
      .from('eden_user_state')
      .update({
        prime_check_json: {
          ...primeCheck,
          metabolism: {
            ...metabolism,
            labs,
          },
        },
      })
      .eq('user_id', user.id)

    if (updateStateErr) {
      console.error('Error updating prime_check_json:', updateStateErr)
      return NextResponse.json({ error: 'Failed to apply lab values' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Lab confirm error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}


