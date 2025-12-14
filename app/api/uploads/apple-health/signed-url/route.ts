import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/uploads/apple-health/signed-url
 * 
 * Returns a signed URL for direct upload to Supabase Storage.
 * This bypasses Vercel's body size limits (4.5MB hobby, 100MB pro).
 * 
 * Flow:
 * 1. Client calls this endpoint to get a signed upload URL
 * 2. Client uploads directly to Supabase Storage using the signed URL
 * 3. Client calls /api/uploads/apple-health/confirm to create the DB record
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
    const body = await request.json().catch(() => ({}))
    const filename = body.filename || 'export.zip'
    const fileSize = body.fileSize || 0
    const source = body.source || 'data_page'

    // 3. Generate storage path
    const uuid = crypto.randomUUID()
    const filePath = `${user.id}/${uuid}.zip`

    // 4. Create signed upload URL (valid for 10 minutes)
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

    // 5. Return signed URL and metadata for confirmation
    return NextResponse.json({
      signedUrl: signedUrl.signedUrl,
      token: signedUrl.token,
      path: signedUrl.path,
      filePath,
      uploadId: uuid,
      expiresIn: 600, // 10 minutes
      metadata: {
        userId: user.id,
        filename,
        fileSize,
        source,
      }
    })

  } catch (error) {
    console.error('Signed URL creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

