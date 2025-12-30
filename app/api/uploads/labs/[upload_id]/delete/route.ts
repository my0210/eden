import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ upload_id: string }>
}

/**
 * DELETE /api/uploads/labs/[upload_id]/delete
 * 
 * Delete a lab upload and its associated file
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { upload_id } = await context.params

    // Get the upload record
    const { data: upload, error: fetchError } = await supabase
      .from('eden_lab_uploads')
      .select('id, file_path, user_id')
      .eq('id', upload_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !upload) {
      return NextResponse.json({ error: 'Lab upload not found' }, { status: 404 })
    }

    // Delete from storage
    if (upload.file_path) {
      const { error: storageError } = await supabase.storage
        .from('lab_reports')
        .remove([upload.file_path])
      
      if (storageError) {
        console.error('Error deleting lab file from storage:', storageError)
        // Continue with database deletion anyway
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('eden_lab_uploads')
      .delete()
      .eq('id', upload_id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting lab upload record:', deleteError)
      return NextResponse.json({ error: 'Failed to delete lab upload' }, { status: 500 })
    }

    // Clear lab values from prime_check_json if this upload was referenced
    const { data: userState } = await supabase
      .from('eden_user_state')
      .select('prime_check_json')
      .eq('user_id', user.id)
      .single()

    if (userState?.prime_check_json) {
      const primeCheck = userState.prime_check_json as Record<string, unknown>
      const metabolism = primeCheck.metabolism as Record<string, unknown> | undefined
      
      if (metabolism?.labs) {
        const labs = metabolism.labs as Record<string, unknown>
        if (labs.upload_id === upload_id) {
          // Clear the labs that came from this upload
          const updatedMetabolism = { ...metabolism }
          delete updatedMetabolism.labs
          
          await supabase
            .from('eden_user_state')
            .update({
              prime_check_json: {
                ...primeCheck,
                metabolism: updatedMetabolism,
              },
            })
            .eq('user_id', user.id)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lab delete error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

