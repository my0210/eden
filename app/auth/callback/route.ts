import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const origin = requestUrl.origin

  const supabase = await createClient()
  
  // For magic links with emailRedirectTo, Supabase should automatically establish the session
  // when redirecting. We just need to check if the user is authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // User is authenticated, redirect to dashboard
    return NextResponse.redirect(new URL(next, origin))
  }

  // If no user and we have a code, the session wasn't created automatically
  // This shouldn't happen with proper configuration, but redirect to home
  return NextResponse.redirect(new URL('/', origin))
}

