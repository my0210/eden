import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { pdfToPng } from 'pdf-to-png-converter'
import {
  LabAnalysisResponse,
  RawLabAnalysis,
  NormalizedLabValues,
  ExtractedLabValue,
  LabMarkerKey,
} from '@/lib/lab-analysis/types'
import {
  LAB_ANALYSIS_SYSTEM_PROMPT,
  LAB_ANALYSIS_USER_PROMPT,
} from '@/lib/lab-analysis/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60 // Analysis may take 15-20 seconds for complex reports

// Allowed MIME types for lab reports
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic', // iPhone photos
  'image/heif',
  'application/pdf', // PDFs converted to images
])

// Max file size: 20MB (lab reports can be larger than photos)
const MAX_FILE_SIZE = 20 * 1024 * 1024

// Map MIME type to file extension
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

/**
 * Normalize extracted lab values to standard units
 */
function normalizeLabValues(extracted: ExtractedLabValue[]): NormalizedLabValues {
  const normalized: NormalizedLabValues = {}

  for (const val of extracted) {
    const key = val.marker_key as LabMarkerKey

    switch (key) {
      case 'apob':
        normalized.apob_mg_dl = val.value
        break
      case 'hba1c':
        normalized.hba1c_percent = val.value
        break
      case 'hscrp':
        // Convert mg/dL to mg/L if needed (mg/L is standard)
        normalized.hscrp_mg_l = val.unit.toLowerCase().includes('dl') 
          ? val.value * 10 
          : val.value
        break
      case 'ldl':
        normalized.ldl_mg_dl = val.value
        break
      case 'hdl':
        normalized.hdl_mg_dl = val.value
        break
      case 'triglycerides':
        normalized.triglycerides_mg_dl = val.value
        break
      case 'total_cholesterol':
        normalized.total_cholesterol_mg_dl = val.value
        break
      case 'fasting_glucose':
        // Convert mmol/L to mg/dL if needed
        normalized.fasting_glucose_mg_dl = val.unit.toLowerCase().includes('mmol')
          ? val.value * 18.02
          : val.value
        break
      case 'fasting_insulin':
        normalized.fasting_insulin_uiu_ml = val.value
        break
      case 'alt':
        normalized.alt_u_l = val.value
        break
      case 'ast':
        normalized.ast_u_l = val.value
        break
      case 'ggt':
        normalized.ggt_u_l = val.value
        break
      case 'egfr':
        normalized.egfr = val.value
        break
      case 'creatinine':
        normalized.creatinine_mg_dl = val.value
        break
      case 'vitamin_d':
        normalized.vitamin_d_ng_ml = val.value
        break
      case 'vitamin_b12':
        normalized.vitamin_b12_pg_ml = val.value
        break
      case 'tsh':
        normalized.tsh_miu_l = val.value
        break
    }
  }

  return normalized
}

/**
 * Parse OpenAI response to structured data
 */
function parseLabAnalysisResponse(responseText: string): { success: boolean; data?: RawLabAnalysis; error?: string } {
  try {
    // Try to extract JSON from the response
    let jsonStr = responseText.trim()
    
    // If wrapped in markdown code blocks, extract
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr) as RawLabAnalysis
    
    // Validate required fields
    if (!parsed.validation || typeof parsed.validation.is_valid !== 'boolean') {
      return { success: false, error: 'Invalid response structure' }
    }

    return { success: true, data: parsed }
  } catch (e) {
    console.error('Failed to parse lab analysis response:', e)
    return { success: false, error: 'Failed to parse AI response' }
  }
}

/**
 * POST /api/uploads/labs/analyze
 * 
 * Upload a lab report image/PDF and extract biomarker values using OpenAI Vision.
 */
export async function POST(request: NextRequest): Promise<NextResponse<LabAnalysisResponse>> {
  try {
    const supabase = await createClient()

    // 1. Auth required
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        validation: { is_valid: false, rejection_reason: 'not_lab_report' },
        markers_found: 0,
        error: 'Please sign in to upload lab results.',
      }, { status: 401 })
    }

    // 2. Parse multipart form
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'Invalid file upload. Please try again.',
      }, { status: 400 })
    }

    // 3. Get file from form data
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'No file provided. Please select a lab report.',
      }, { status: 400 })
    }

    // 4. Validate file type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'Please upload a photo, screenshot, or PDF (JPEG, PNG, WebP, or PDF).',
      }, { status: 400 })
    }

    // 5. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'File is too large. Please use a file under 20MB.',
      }, { status: 400 })
    }

    // 6. Upload to Supabase Storage
    const uuid = crypto.randomUUID()
    const ext = MIME_TO_EXT[file.type] || 'jpg'
    const filePath = `${user.id}/${uuid}.${ext}`

    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('lab_reports')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'Failed to upload file. Please try again.',
      }, { status: 500 })
    }

    // 7. Get signed URL for OpenAI (expires in 15 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('lab_reports')
      .createSignedUrl(filePath, 15 * 60)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError)
      await supabase.storage.from('lab_reports').remove([filePath])
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'Failed to process file. Please try again.',
      }, { status: 500 })
    }

    // 8. Call OpenAI Vision API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Convert PDF to images if needed
    const isPdf = file.type === 'application/pdf'
    let imageContents: Array<{ type: 'image_url'; image_url: { url: string; detail: 'high' } }> = []

    if (isPdf) {
      try {
        // Convert PDF pages to PNG images (all pages)
        const pngPages = await pdfToPng(Buffer.from(fileBuffer), {
          disableFontFace: true,
          useSystemFonts: true,
          viewportScale: 2.0, // Higher quality for text readability
        })

        // Convert each page to base64 and add to image contents
        for (const page of pngPages) {
          const base64 = page.content.toString('base64')
          imageContents.push({
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64}`,
              detail: 'high' as const,
            },
          })
        }
      } catch (pdfError) {
        console.error('PDF conversion error:', pdfError)
        await supabase.storage.from('lab_reports').remove([filePath])
        return NextResponse.json({
          success: false,
          validation: { is_valid: false },
          markers_found: 0,
          error: 'Failed to process PDF. Please try taking a photo of your lab report instead.',
        }, { status: 500 })
      }
    } else {
      // For images, use the signed URL directly
      imageContents = [{
        type: 'image_url',
        image_url: {
          url: signedUrlData.signedUrl,
          detail: 'high' as const,
        },
      }]
    }

    let analysis: RawLabAnalysis
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: LAB_ANALYSIS_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: LAB_ANALYSIS_USER_PROMPT,
              },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.2, // Lower temperature for more consistent extraction
      })

      const responseText = completion.choices[0]?.message?.content
      if (!responseText) {
        throw new Error('No response from OpenAI')
      }

      const parsed = parseLabAnalysisResponse(responseText)
      if (!parsed.success || !parsed.data) {
        throw new Error(parsed.error || 'Failed to parse response')
      }

      analysis = parsed.data
    } catch (e) {
      console.error('OpenAI analysis error:', e)
      await supabase.storage.from('lab_reports').remove([filePath])
      return NextResponse.json({
        success: false,
        validation: { is_valid: false },
        markers_found: 0,
        error: 'Lab analysis failed. Please try again.',
      }, { status: 500 })
    }

    // 9. Handle validation rejection
    if (!analysis.validation.is_valid) {
      await supabase.storage.from('lab_reports').remove([filePath])
      
      return NextResponse.json({
        success: false,
        validation: analysis.validation,
        markers_found: 0,
        error: analysis.validation.user_message || 'This doesn\'t appear to be a valid lab report.',
      })
    }

    // 10. Normalize extracted values
    const normalizedValues = normalizeLabValues(analysis.extracted_values || [])
    const markersFound = Object.keys(normalizedValues).length

    // 11. Create database record
    const { data: labRecord, error: insertError } = await supabase
      .from('eden_lab_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type.includes('pdf') ? 'pdf' : 'image',
        file_size_bytes: file.size,
        status: 'completed',
        extracted_values: analysis.extracted_values,
        lab_date: analysis.lab_info?.test_date,
        lab_provider: analysis.lab_info?.lab_provider,
        analysis_metadata: {
          raw_analysis: analysis,
          normalized_values: normalizedValues,
        },
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      // Don't fail - analysis was successful
    }

    // 12. Return success response
    return NextResponse.json({
      success: true,
      upload_id: labRecord?.id || uuid,
      validation: analysis.validation,
      lab_info: analysis.lab_info,
      extracted_values: analysis.extracted_values,
      normalized_values: normalizedValues,
      markers_found: markersFound,
    })

  } catch (error) {
    console.error('Lab analyze error:', error)
    return NextResponse.json({
      success: false,
      validation: { is_valid: false },
      markers_found: 0,
      error: 'Something went wrong. Please try again.',
    }, { status: 500 })
  }
}

