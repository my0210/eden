import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Generate a signed upload URL for direct-to-storage upload
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get filename from query params
    const filename = request.nextUrl.searchParams.get('filename')
    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 })
    }

    // Validate file type
    if (!filename.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .zip file.' },
        { status: 400 }
      )
    }

    // Generate file path
    const filePath = `${user.id}/${Date.now()}-${filename}`

    // Create signed upload URL (valid for 10 minutes)
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from('apple_health_uploads')
      .createSignedUploadUrl(filePath)

    if (signedUrlError || !signedUrl) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to create upload URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signedUrl: signedUrl.signedUrl,
      token: signedUrl.token,
      path: signedUrl.path,
      filePath,
    })
  } catch (error) {
    console.error('Error creating signed URL:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Confirm upload and create import record
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { filePath, fileSize } = await request.json()

    if (!filePath) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 })
    }

    // Insert import record
    const { data: importData, error: insertError } = await supabase
      .from('apple_health_imports')
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_size: fileSize || 0,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !importData) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to record upload' },
        { status: 500 }
      )
    }

    return NextResponse.json({ importId: importData.id })
  } catch (error) {
    console.error('Error in apple-health upload:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
