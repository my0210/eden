import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const origin = requestUrl.origin

  const supabase = await createClient()
  
  // First check if user is already authenticated (Supabase might have created session automatically)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return NextResponse.redirect(new URL(next, origin))
  }

  // If we have a code but no user, we need to exchange it for a session
  // Note: For PKCE flows, this requires the code verifier, but for magic links
  // Supabase should handle this automatically. If not, we'll get an error.
  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Code exchange error:', error)
        // If exchange fails, redirect to home with error
        const homeUrl = new URL('/', origin)
        homeUrl.searchParams.set('error', 'auth_failed')
        homeUrl.searchParams.set('details', encodeURIComponent(error.message))
        return NextResponse.redirect(homeUrl)
      }

      // Verify user was created
      const {
        data: { user: newUser },
      } = await supabase.auth.getUser()

      if (newUser) {
        return NextResponse.redirect(new URL(next, origin))
      }
    } catch (error) {
      console.error('Auth callback exception:', error)
      const homeUrl = new URL('/', origin)
      homeUrl.searchParams.set('error', 'exception')
      return NextResponse.redirect(homeUrl)
    }
  }

  // No code and no user - redirect to home
  return NextResponse.redirect(new URL('/', origin))
}

