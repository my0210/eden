import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  PhotoAnalysisResponse,
  BodyPhotoAnalysis,
  PhotoUploadMetadata,
  calculateLeanMass,
  isUnableToEstimate,
  REJECTION_MESSAGES,
  BodyFatEstimate,
} from '@/lib/photo-analysis/types'
import {
  buildPhotoAnalysisMessages,
  parsePhotoAnalysisResponse,
} from '@/lib/photo-analysis/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60 // Analysis may take 10-15 seconds

// Allowed MIME types for photos
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
])

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Map MIME type to file extension
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
}

/**
 * POST /api/uploads/photos/analyze
 * 
 * Upload a body photo and analyze it using OpenAI Vision.
 * Returns body fat estimate and midsection adiposity.
 */
export async function POST(request: NextRequest): Promise<NextResponse<PhotoAnalysisResponse>> {
  try {
    const supabase = await createClient()

    // 1. Auth required
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'auth_error',
        user_message: 'Please sign in to upload photos.',
      }, { status: 401 })
    }

    // 2. Parse multipart form
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({
        success: false,
        error: 'upload_error',
        user_message: 'Invalid file upload. Please try again.',
      }, { status: 400 })
    }

    // 3. Get file from form data
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'upload_error',
        user_message: 'No file provided. Please select a photo.',
      }, { status: 400 })
    }

    // 4. Validate file type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'upload_error',
        user_message: 'Please upload a JPEG, PNG, or WebP image.',
      }, { status: 400 })
    }

    // 5. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'upload_error',
        user_message: 'Photo is too large. Please use an image under 10MB.',
      }, { status: 400 })
    }

    // 6. Get source and user weight (for lean mass calculation)
    const source = (formData.get('source') as string) || 'onboarding'
    const weightKgStr = formData.get('weight_kg') as string | null
    const weightKg = weightKgStr ? parseFloat(weightKgStr) : undefined

    // 7. Upload to Supabase Storage
    const uuid = crypto.randomUUID()
    const ext = MIME_TO_EXT[file.type] || 'jpg'
    const filePath = `${user.id}/${uuid}.${ext}`

    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('body_photos')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({
        success: false,
        error: 'upload_error',
        user_message: 'Failed to upload photo. Please try again.',
      }, { status: 500 })
    }

    // 8. Get signed URL for OpenAI (expires in 15 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('body_photos')
      .createSignedUrl(filePath, 15 * 60) // 15 minutes

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError)
      // Clean up uploaded file
      await supabase.storage.from('body_photos').remove([filePath])
      return NextResponse.json({
        success: false,
        error: 'upload_error',
        user_message: 'Failed to process photo. Please try again.',
      }, { status: 500 })
    }

    // 9. Call OpenAI Vision API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    let analysis: BodyPhotoAnalysis
    try {
      const messages = buildPhotoAnalysisMessages(signedUrlData.signedUrl)
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent results
      })

      const responseText = completion.choices[0]?.message?.content
      if (!responseText) {
        throw new Error('No response from OpenAI')
      }

      const parsed = parsePhotoAnalysisResponse(responseText)
      if (!parsed.success || !parsed.data) {
        throw new Error(parsed.error || 'Failed to parse response')
      }

      analysis = parsed.data as BodyPhotoAnalysis
    } catch (e) {
      console.error('OpenAI analysis error:', e)
      // Clean up uploaded file on analysis failure
      await supabase.storage.from('body_photos').remove([filePath])
      return NextResponse.json({
        success: false,
        error: 'analysis_error',
        user_message: 'Photo analysis failed. Please try again.',
      }, { status: 500 })
    }

    // 10. Handle validation rejection
    if (!analysis.validation.valid) {
      // Delete the rejected photo from storage
      await supabase.storage.from('body_photos').remove([filePath])
      
      const userMessage = analysis.validation.user_message || 
        (analysis.validation.rejection_reason 
          ? REJECTION_MESSAGES[analysis.validation.rejection_reason]
          : 'Please try a different photo.')

      return NextResponse.json({
        success: false,
        error: 'validation_failed',
        user_message: userMessage,
      })
    }

    // 11. Calculate derived values (lean mass)
    let derived: { lean_mass_estimate_kg?: { range_low: number; range_high: number } } | undefined
    if (
      weightKg &&
      analysis.body_fat_estimate &&
      !isUnableToEstimate(analysis.body_fat_estimate)
    ) {
      derived = {
        lean_mass_estimate_kg: calculateLeanMass(weightKg, analysis.body_fat_estimate as BodyFatEstimate),
      }
    }

    // 12. Create database record
    const metadata: PhotoUploadMetadata = {
      source,
      analysis,
      derived,
      weight_kg: weightKg,
    }

    const { data: photoRecord, error: insertError } = await supabase
      .from('eden_photo_uploads')
      .insert({
        user_id: user.id,
        kind: 'body_photo',
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        status: 'completed',
        processed_at: new Date().toISOString(),
        metadata_json: metadata,
      })
      .select('id')
      .single()

    if (insertError || !photoRecord) {
      console.error('Database insert error:', insertError)
      // Don't delete the photo - it was successfully analyzed
      // Just return the analysis results
    }

    // 13. Update prime_check_json.frame.photo_analysis for scorecard
    // This is needed so the scoring engine picks up the photo analysis results
    try {
      // Get current user state
      const { data: currentState } = await supabase
        .from('eden_user_state')
        .select('prime_check_json')
        .eq('user_id', user.id)
        .maybeSingle()

      // Build photo_analysis object for scoring
      const bodyFatRange = !isUnableToEstimate(analysis.body_fat_estimate) 
        ? {
            low: (analysis.body_fat_estimate as BodyFatEstimate).range_low,
            high: (analysis.body_fat_estimate as BodyFatEstimate).range_high,
          }
        : undefined

      const midsectionAdiposityLevel = 
        analysis.midsection_adiposity && !isUnableToEstimate(analysis.midsection_adiposity)
          ? (analysis.midsection_adiposity as { level: string }).level
          : undefined

      const photoAnalysisForScoring = {
        upload_id: photoRecord?.id || uuid,
        body_fat_range: bodyFatRange,
        midsection_adiposity: midsectionAdiposityLevel,
        lean_mass_range_kg: derived?.lean_mass_estimate_kg,
        analyzed_at: new Date().toISOString(),
      }

      // Merge into prime_check_json.frame
      const currentPrimeCheck = (currentState?.prime_check_json || {}) as Record<string, unknown>
      const currentFrame = (currentPrimeCheck.frame || {}) as Record<string, unknown>
      
      const updatedPrimeCheck = {
        ...currentPrimeCheck,
        // Ensure schema_version exists so scoring uses V3 flow with photo analysis
        schema_version: currentPrimeCheck.schema_version || 1,
        frame: {
          ...currentFrame,
          photo_analysis: photoAnalysisForScoring,
        },
      }

      // Upsert to eden_user_state
      await supabase
        .from('eden_user_state')
        .upsert(
          { 
            user_id: user.id, 
            prime_check_json: updatedPrimeCheck,
          },
          { onConflict: 'user_id' }
        )
    } catch (updateErr) {
      // Non-fatal: log but don't fail the request
      console.error('Failed to update prime_check_json with photo analysis:', updateErr)
    }

    // 14. Return success response
    return NextResponse.json({
      success: true,
      upload_id: photoRecord?.id || uuid,
      analysis,
      derived,
    })

  } catch (error) {
    console.error('Photo analyze error:', error)
    return NextResponse.json({
      success: false,
      error: 'analysis_error',
      user_message: 'Something went wrong. Please try again.',
    }, { status: 500 })
  }
}

