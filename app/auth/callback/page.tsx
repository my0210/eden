'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuth = async () => {
      // Check for code in both query params and hash (Supabase might use either)
      const code = searchParams.get('code') || (typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.substring(1)).get('code') : null)
      const next = searchParams.get('next') || '/dashboard'

      // For magic links with redirects, Supabase should automatically establish the session
      // when the user clicks the link. We just need to check if the session exists.
      // The code in the URL is for Supabase's internal tracking, not for us to verify.
      try {
        const supabase = createClient()
        
        // Verify environment variables are available
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error('Missing Supabase environment variables')
          router.replace(`/?error=config_error&details=Missing environment variables`)
          return
        }
        
        // Wait a moment for Supabase to set cookies (if redirect just happened)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Check if session exists (Supabase should have created it automatically)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (session && session.user) {
          console.log('Session found, redirecting to dashboard')
          router.replace(next)
          return
        }
        
        // If no session, check user directly (might be in cookies but not in session yet)
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (user) {
          console.log('User found, redirecting to dashboard')
          router.replace(next)
          return
        }
        
        // If we have a code but no session/user, the link might be invalid or expired
        if (code) {
          console.error('Code present but no session/user found. Code:', code.substring(0, 20) + '...')
          router.replace(`/?error=auth_failed&details=${encodeURIComponent('Session not found. The link may have expired or been used already.')}`)
          return
        }
        
        // No code and no user - redirect to home
        router.replace('/')
      } catch (error) {
        console.error('Auth callback exception:', error)
        router.replace(`/?error=exception`)
      }
    }

    handleAuth()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}

