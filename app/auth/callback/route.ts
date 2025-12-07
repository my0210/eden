import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/chat'
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
    
    console.error('Auth callback error:', error.message)
  }

  // No code or exchange failed - redirect to home with error
  const homeUrl = new URL('/', origin)
  homeUrl.searchParams.set('error', 'auth_failed')
  homeUrl.searchParams.set('details', 'Session not found. Please try requesting a new magic link.')
  return NextResponse.redirect(homeUrl)
}
