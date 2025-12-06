import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const origin = requestUrl.origin

  const supabase = await createClient()
  
  // For magic links with emailRedirectTo, Supabase automatically creates the session
  // when redirecting. We just need to check if the user is authenticated.
  // Wait a moment for cookies to be set
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return NextResponse.redirect(new URL(next, origin))
  }

  // No user - redirect to home with error
  const homeUrl = new URL('/', origin)
  homeUrl.searchParams.set('error', 'auth_failed')
  homeUrl.searchParams.set('details', 'Session not found. Please try requesting a new magic link.')
  return NextResponse.redirect(homeUrl)
}

