import { createClient } from '@/lib/supabase/server'
import { getUserState, getRedirectPath } from '@/lib/onboarding/getUserState'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Get or create user state and determine redirect
        const userState = await getUserState(supabase, user.id)
        const redirectPath = getRedirectPath(userState)
        return NextResponse.redirect(new URL(redirectPath, origin))
      }
      
      // Fallback if user somehow not available after session exchange
      return NextResponse.redirect(new URL('/onboarding/1', origin))
    }
    
    console.error('Auth callback error:', error.message)
  }

  // No code or exchange failed - redirect to home with error
  const homeUrl = new URL('/', origin)
  homeUrl.searchParams.set('error', 'auth_failed')
  homeUrl.searchParams.set('details', 'Session not found. Please try requesting a new magic link.')
  return NextResponse.redirect(homeUrl)
}
