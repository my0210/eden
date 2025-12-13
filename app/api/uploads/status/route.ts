import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface AppleHealthImport {
  id: string
  user_id: string
  file_path: string
  file_size: number
  status: string
  uploaded_at: string | null
  processing_started_at: string | null
  processed_at: string | null
  failed_at: string | null
  error_message: string | null
  source: string | null
  created_at: string
}

interface PhotoUpload {
  id: string
  user_id: string
  kind: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  status: string
  processed_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
}

interface StatusResponse {
  appleHealth: {
    latest: AppleHealthImport | null
    pending: number
    processing: number
    completed: number
    failed: number
  }
  photos: {
    recent: PhotoUpload[]
    total: number
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Auth required
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get latest Apple Health import
    const { data: latestImport, error: importError } = await supabase
      .from('apple_health_imports')
      .select(`
        id, user_id, file_path, file_size, status,
        uploaded_at, processing_started_at, processed_at, failed_at,
        error_message, source, created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (importError) {
      console.error('Error fetching Apple Health import:', importError)
    }

    // 3. Get Apple Health import counts by status
    const { data: importCounts, error: countError } = await supabase
      .from('apple_health_imports')
      .select('status')
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error fetching import counts:', countError)
    }

    const statusCounts = {
      pending: 0,  // uploaded status
      processing: 0,
      completed: 0,
      failed: 0,
    }

    if (importCounts) {
      for (const row of importCounts) {
        if (row.status === 'uploaded' || row.status === 'pending') {
          statusCounts.pending++
        } else if (row.status === 'processing') {
          statusCounts.processing++
        } else if (row.status === 'completed') {
          statusCounts.completed++
        } else if (row.status === 'failed') {
          statusCounts.failed++
        }
      }
    }

    // 4. Get latest 10 photo uploads
    const { data: recentPhotos, error: photosError } = await supabase
      .from('eden_photo_uploads')
      .select(`
        id, user_id, kind, file_path, file_size, mime_type, status,
        processed_at, failed_at, error_message, created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (photosError) {
      console.error('Error fetching photo uploads:', photosError)
    }

    // 5. Get total photo count
    const { count: photoCount, error: photoCountError } = await supabase
      .from('eden_photo_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (photoCountError) {
      console.error('Error fetching photo count:', photoCountError)
    }

    // 6. Return stable response
    const response: StatusResponse = {
      appleHealth: {
        latest: latestImport as AppleHealthImport | null,
        ...statusCounts,
      },
      photos: {
        recent: (recentPhotos || []) as PhotoUpload[],
        total: photoCount || 0,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Upload status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

