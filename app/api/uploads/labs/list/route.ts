import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/uploads/labs/list
 * 
 * List all lab uploads for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: uploads, error } = await supabase
      .from('eden_lab_uploads')
      .select('id, file_name, file_type, status, lab_date, lab_provider, extracted_values, created_at, processed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching lab uploads:', error)
      return NextResponse.json({ error: 'Failed to fetch lab uploads' }, { status: 500 })
    }

    return NextResponse.json({ uploads: uploads || [] })
  } catch (error) {
    console.error('Lab list error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

