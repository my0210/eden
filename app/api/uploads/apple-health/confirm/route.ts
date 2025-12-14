import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/uploads/apple-health/confirm
 * 
 * Confirms a direct upload completed and creates the DB record.
 * Called after client uploads directly to Supabase Storage via signed URL.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth required
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = await request.json()
    const { filePath, fileSize, filename, source } = body

    if (!filePath) {
      return NextResponse.json(
        { error: 'Missing filePath' },
        { status: 400 }
      )
    }

    // 3. Verify the file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('apple_health_uploads')
      .list(user.id, {
        search: filePath.split('/').pop(),
      })

    if (fileError) {
      console.error('File verification error:', fileError)
      return NextResponse.json(
        { error: 'Failed to verify upload' },
        { status: 500 }
      )
    }

    // Check if file was found
    const uploadedFile = fileData?.find(f => filePath.includes(f.name))
    if (!uploadedFile) {
      return NextResponse.json(
        { error: 'Upload not found. Please try uploading again.' },
        { status: 404 }
      )
    }

    // 4. Create DB record
    const { data: importData, error: insertError } = await supabase
      .from('apple_health_imports')
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_size: fileSize || uploadedFile.metadata?.size || 0,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        source: source || 'data_page',
        metadata_json: {
          original_filename: filename || 'export.zip',
          upload_method: 'signed_url',
        },
      })
      .select('id, user_id, file_path, file_size, status, uploaded_at, source, created_at')
      .single()

    if (insertError || !importData) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to record upload in database.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      import: importData,
    })

  } catch (error) {
    console.error('Confirm upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

