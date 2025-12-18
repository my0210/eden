import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/apple-health-imports
 * 
 * Returns all Apple Health imports for the authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all imports for user
    const { data: imports, error: fetchError } = await supabase
      .from('apple_health_imports')
      .select('id, status, file_path, file_size, uploaded_at, processed_at, failed_at, error_message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching imports:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 })
    }

    return NextResponse.json({ imports: imports || [] })
  } catch (error) {
    console.error('Error in apple-health-imports route:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

