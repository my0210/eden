import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large files

// Increase body size limit for large Apple Health exports
// Note: Vercel Pro allows up to 100MB, Hobby is limited to 4.5MB
// For files > 100MB, use the signed URL upload endpoint instead
export const fetchCache = 'force-no-store'

interface AppleHealthImport {
  id: string
  user_id: string
  file_path: string
  file_size: number
  status: string
  uploaded_at: string
  source: string
  created_at: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth required
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse multipart form
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data. Expected multipart/form-data.' },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null
    const source = (formData.get('source') as string) || 'onboarding'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Expected field "file".' },
        { status: 400 }
      )
    }

    // 3. Validate .zip
    const filename = file.name.toLowerCase()
    if (!filename.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .zip file exported from Apple Health.' },
        { status: 400 }
      )
    }

    // 4. Generate storage key: userId/uuid.zip
    const uuid = crypto.randomUUID()
    const filePath = `${user.id}/${uuid}.zip`

    // 5. Upload to apple_health_uploads bucket
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('apple_health_uploads')
      .upload(filePath, fileBuffer, {
        contentType: 'application/zip',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // 6. Insert into apple_health_imports with new schema
    const { data: importData, error: insertError } = await supabase
      .from('apple_health_imports')
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_size: file.size,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        source: source,
        metadata_json: {
          original_filename: file.name,
          upload_method: 'multipart',
        },
      })
      .select('id, user_id, file_path, file_size, status, uploaded_at, source, created_at')
      .single()

    if (insertError || !importData) {
      console.error('Database insert error:', insertError)
      // Try to clean up the uploaded file
      await supabase.storage.from('apple_health_uploads').remove([filePath])
      return NextResponse.json(
        { error: 'Failed to record upload in database.' },
        { status: 500 }
      )
    }

    // 7. Return stable response
    return NextResponse.json({
      import: importData as AppleHealthImport,
    })
  } catch (error) {
    console.error('Apple Health upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

