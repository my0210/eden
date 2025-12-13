import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Allowed MIME types for photos
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
])

// Map MIME type to file extension
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
}

interface PhotoUpload {
  id: string
  user_id: string
  kind: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  status: string
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

    // Get all files from form data (field name: files or files[])
    const files: File[] = []
    for (const [key, value] of formData.entries()) {
      if ((key === 'files' || key === 'files[]' || key === 'file') && value instanceof File) {
        files.push(value)
      }
    }

    const source = (formData.get('source') as string) || 'onboarding'
    const kind = (formData.get('kind') as string) || 'body_photo'

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided. Expected field "files" or "files[]".' },
        { status: 400 }
      )
    }

    // 3. Validate MIME types
    const invalidFiles: string[] = []
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        invalidFiles.push(`${file.name} (${file.type || 'unknown type'})`)
      }
    }

    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { error: `Invalid file types: ${invalidFiles.join(', ')}. Allowed: JPEG, PNG, HEIC, WebP.` },
        { status: 400 }
      )
    }

    // 4. Upload each file and create DB records
    const uploads: PhotoUpload[] = []
    const errors: string[] = []

    for (const file of files) {
      const uuid = crypto.randomUUID()
      const ext = MIME_TO_EXT[file.type] || 'jpg'
      const filePath = `${user.id}/${uuid}.${ext}`

      try {
        // Upload to body_photos bucket
        const fileBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabase.storage
          .from('body_photos')
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          errors.push(`${file.name}: ${uploadError.message}`)
          continue
        }

        // Insert into eden_photo_uploads
        const { data: photoData, error: insertError } = await supabase
          .from('eden_photo_uploads')
          .insert({
            user_id: user.id,
            kind: kind,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            status: 'uploaded',
            metadata_json: {
              original_filename: file.name,
              source: source,
              upload_method: 'multipart',
            },
          })
          .select('id, user_id, kind, file_path, file_size, mime_type, status, created_at')
          .single()

        if (insertError || !photoData) {
          // Try to clean up the uploaded file
          await supabase.storage.from('body_photos').remove([filePath])
          errors.push(`${file.name}: Failed to record in database`)
          continue
        }

        uploads.push(photoData as PhotoUpload)
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // 5. Return response
    if (uploads.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: `All uploads failed: ${errors.join('; ')}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      uploads,
      ...(errors.length > 0 && { errors }),
    })
  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

