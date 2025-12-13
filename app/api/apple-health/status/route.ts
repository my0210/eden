import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get importId from query params
    const importId = request.nextUrl.searchParams.get('importId')
    if (!importId) {
      return NextResponse.json({ error: 'importId is required' }, { status: 400 })
    }

    // Fetch import status (RLS ensures user can only see their own)
    const { data: importData, error: fetchError } = await supabase
      .from('apple_health_imports')
      .select('id, status, error_message, processed_at, created_at')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !importData) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    return NextResponse.json({
      importId: importData.id,
      status: importData.status,
      errorMessage: importData.error_message,
      processedAt: importData.processed_at,
      createdAt: importData.created_at,
    })
  } catch (error) {
    console.error('Error fetching import status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

