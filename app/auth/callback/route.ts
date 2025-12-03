import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Verify the session was established
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (user) {
        // Session established successfully, redirect to dashboard
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Check if user is already authenticated (in case of direct access)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // If there's an error or no code, redirect to home
  return NextResponse.redirect(`${origin}/`)
}

