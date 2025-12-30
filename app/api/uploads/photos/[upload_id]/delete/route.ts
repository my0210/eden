import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/uploads/photos/[upload_id]/delete
 * Delete a body photo upload and its associated storage file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { upload_id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const uploadId = params.upload_id

    // First, get the upload record to find the storage path
    const { data: upload, error: fetchError } = await supabase
      .from('eden_photo_uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    // Delete from storage if we have a file path
    if (upload.file_path) {
      const { error: storageError } = await supabase.storage
        .from('body_photos')
        .remove([upload.file_path])
      
      if (storageError) {
        console.error('Error deleting from storage:', storageError)
        // Continue anyway - we still want to delete the DB record
      }
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('eden_photo_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting upload record:', deleteError)
      return NextResponse.json({ error: 'Failed to delete upload' }, { status: 500 })
    }

    // Clear photo_analysis from prime_check_json if this was the analyzed photo
    const { data: userState } = await supabase
      .from('eden_user_state')
      .select('prime_check_json')
      .eq('user_id', user.id)
      .single()

    if (userState?.prime_check_json) {
      const primeCheck = userState.prime_check_json as {
        frame?: {
          photo_analysis?: { upload_id?: string }
        }
      }
      
      if (primeCheck.frame?.photo_analysis?.upload_id === uploadId) {
        // Remove the photo_analysis from prime_check_json
        const { frame, ...restPrimeCheck } = primeCheck
        const { photo_analysis, ...restFrame } = frame || {}
        
        await supabase
          .from('eden_user_state')
          .update({
            prime_check_json: {
              ...restPrimeCheck,
              frame: restFrame,
            },
          })
          .eq('user_id', user.id)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Photo upload deleted successfully'
    })
  } catch (error) {
    console.error('Error in photo upload delete:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

