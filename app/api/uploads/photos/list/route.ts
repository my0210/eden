import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/uploads/photos/list
 * List all body photo uploads for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch photo uploads
    const { data: uploads, error } = await supabase
      .from('eden_photo_uploads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching photo uploads:', error)
      return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 })
    }

    return NextResponse.json({ uploads: uploads || [] })
  } catch (error) {
    console.error('Error in photo uploads list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

