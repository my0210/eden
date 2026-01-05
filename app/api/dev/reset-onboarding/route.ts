import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_EMAILS = process.env.ALLOWED_DEV_EMAILS?.split(',').map(e => e.trim()) || []

function isDevAllowed(email: string | undefined): boolean {
  // Check env var first
  if (process.env.ALLOW_DEV_TOOLS === 'true') {
    return true
  }
  
  // Check email allow-list
  if (email && ALLOWED_EMAILS.length > 0) {
    return ALLOWED_EMAILS.includes(email)
  }
  
  return false
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check dev access
    if (!isDevAllowed(user.email)) {
      return NextResponse.json({ error: 'Forbidden: Dev tools not enabled' }, { status: 403 })
    }

    // Delete scorecards for clean testing
    const { error: scorecardsDeleteError } = await supabase
      .from('eden_user_scorecards')
      .delete()
      .eq('user_id', user.id)

    if (scorecardsDeleteError) {
      console.error('reset-onboarding: eden_user_scorecards delete error', scorecardsDeleteError)
    }

    // Delete body photos (storage + DB records) for clean testing
    try {
      const { data: photos } = await supabase
        .from('eden_photo_uploads')
        .select('id, file_path')
        .eq('user_id', user.id)

      if (photos && photos.length > 0) {
        // Delete files from storage
        const storagePaths = photos
          .map(p => p.file_path)
          .filter(Boolean) as string[]
        
        if (storagePaths.length > 0) {
          await supabase.storage
            .from('body_photos')
            .remove(storagePaths)
        }

        // Delete DB records
        await supabase
          .from('eden_photo_uploads')
          .delete()
          .eq('user_id', user.id)
      }
    } catch (photoErr) {
      console.error('reset-onboarding: photo cleanup error', photoErr)
    }

    // Delete lab uploads (storage + DB records) for clean testing
    try {
      const { data: labs } = await supabase
        .from('eden_lab_uploads')
        .select('id, file_path')
        .eq('user_id', user.id)

      if (labs && labs.length > 0) {
        // Delete files from storage
        const storagePaths = labs
          .map(l => l.file_path)
          .filter(Boolean) as string[]
        
        if (storagePaths.length > 0) {
          await supabase.storage
            .from('lab_reports')
            .remove(storagePaths)
        }

        // Delete DB records
        await supabase
          .from('eden_lab_uploads')
          .delete()
          .eq('user_id', user.id)
      }
    } catch (labErr) {
      console.error('reset-onboarding: lab upload cleanup error', labErr)
    }

    // Delete Apple Health imports for clean testing
    const { error: ahDeleteError } = await supabase
      .from('apple_health_imports')
      .delete()
      .eq('user_id', user.id)

    if (ahDeleteError) {
      console.error('reset-onboarding: apple_health_imports delete error', ahDeleteError)
    }

    // Delete metrics for clean testing
    const { error: metricsDeleteError } = await supabase
      .from('eden_metric_values')
      .delete()
      .eq('user_id', user.id)

    if (metricsDeleteError) {
      console.error('reset-onboarding: eden_metric_values delete error', metricsDeleteError)
    }

    // Delete user memory (gets re-initialized on onboarding complete)
    const { error: memoryDeleteError } = await supabase
      .from('eden_user_memory')
      .delete()
      .eq('user_id', user.id)

    if (memoryDeleteError) {
      console.error('reset-onboarding: eden_user_memory delete error', memoryDeleteError)
    }

    // Reset onboarding state with all new v2/v3 fields cleared
    const { error: updateError } = await supabase
      .from('eden_user_state')
      .update({
        onboarding_status: 'not_started',
        onboarding_step: 1,
        // Clear goals_json (v2: focus_primary, focus_secondary, uploads_skipped)
        goals_json: {},
        // Clear identity_json (v2: dob, age, sex_at_birth, height, weight, units)
        identity_json: {},
        // Clear safety_json (v2: privacy_ack, diagnoses, meds, injuries_limitations, red_lines, doctor_restrictions)
        safety_json: {},
        // Clear prime_check_json (v3: all domain self-assessments, photo analysis, focus check results)
        prime_check_json: {},
        // Clear legacy fields (no longer used in v2 but reset for clean state)
        behaviors_json: {},
        coaching_json: {},
        latest_scorecard_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error resetting onboarding:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset onboarding state' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in reset-onboarding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
