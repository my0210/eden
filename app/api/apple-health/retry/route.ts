import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { importId } = await request.json()
    if (!importId) {
      return NextResponse.json({ error: 'importId is required' }, { status: 400 })
    }

    // Fetch import to verify ownership and status
    const { data: importData, error: fetchError } = await supabase
      .from('apple_health_imports')
      .select('id, status, user_id')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !importData) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // Only allow retry if status is 'failed'
    if (importData.status !== 'failed') {
      return NextResponse.json(
        { error: `Cannot retry import with status '${importData.status}'. Only failed imports can be retried.` },
        { status: 400 }
      )
    }

    // Reset to pending status
    const { error: updateError } = await supabase
      .from('apple_health_imports')
      .update({
        status: 'pending',
        error_message: null,
      })
      .eq('id', importId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reset import status' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Import reset to pending. It will be processed by the next cron job.' 
    })
  } catch (error) {
    console.error('Error retrying import:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

