import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .zip file.' },
        { status: 400 }
      )
    }

    // Upload to storage
    const filePath = `${user.id}/${Date.now()}-${file.name}`
    const fileBuffer = await file.arrayBuffer()
    
    const { error: uploadError } = await supabase.storage
      .from('apple_health_uploads')
      .upload(filePath, fileBuffer, {
        contentType: 'application/zip',
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed: ' + uploadError.message },
        { status: 500 }
      )
    }

    // Insert import record
    const { data: importData, error: insertError } = await supabase
      .from('apple_health_imports')
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_size: file.size,
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

