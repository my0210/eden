import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint is triggered by Vercel Cron
// It processes up to N pending Apple Health imports
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch processing

// Create anon client for cron job (uses database function to bypass RLS)
function getAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Check for cron secret (required for security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAnonClient()
    
    // Get up to 3 pending imports using database function (bypasses RLS)
    const { data: pendingImports, error: fetchError } = await supabase
      .rpc('get_pending_imports', { limit_count: 3 })

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
            'authorization': cronSecret ? `Bearer ${cronSecret}` : '',
            'x-cron-job': 'true', // Flag for cron job calls
            'x-user-id': importRow.user_id, // Pass user ID for context
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

