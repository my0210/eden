import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint is triggered by Vercel Cron
// It processes up to N pending Apple Health imports
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch processing

// Create service role client for cron job (bypasses RLS)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for cron jobs')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Check for cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceClient()
    
    // Get up to 3 pending imports (process in batches)
    const { data: pendingImports, error: fetchError } = await supabase
      .from('apple_health_imports')
      .select('id, user_id, file_path, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(3)

    if (fetchError) {
      console.error('Error fetching pending imports:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!pendingImports || pendingImports.length === 0) {
      return NextResponse.json({ 
        processed: 0, 
        message: 'No pending imports' 
      })
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      importIds: [] as string[],
    }

    // Import the processImport function from a shared module
    // For now, we'll call the HTTP endpoint internally
    // TODO: Extract processing logic to shared module for better reusability
    
    // Process each import by calling the process endpoint
    for (const importRow of pendingImports) {
      results.importIds.push(importRow.id)
      
      try {
        // Call the process endpoint via HTTP
        // The process endpoint will handle status updates and actual processing
        const baseUrl = request.nextUrl.origin
        const processUrl = `${baseUrl}/api/apple-health/process`
        
        const processResponse = await fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-service': 'true', // Flag for internal calls
            'x-user-id': importRow.user_id, // Pass user ID for RLS bypass
          },
          body: JSON.stringify({ importId: importRow.id }),
        })

        if (processResponse.ok) {
          results.succeeded++
        } else {
          results.failed++
          const errorData = await processResponse.json().catch(() => ({}))
          console.error(`Failed to process import ${importRow.id}:`, errorData)
        }
      } catch (err) {
        results.failed++
        console.error(`Error processing import ${importRow.id}:`, err)
        
        // Mark as failed
        await supabase
          .from('apple_health_imports')
          .update({ 
            status: 'failed', 
            error_message: err instanceof Error ? err.message.substring(0, 500) : 'Unknown error' 
          })
          .eq('id', importRow.id)
      }
      
      results.processed++
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in process-imports job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

