'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuth = async () => {
      const code = searchParams.get('code')
      const next = searchParams.get('next') || '/dashboard'

      if (code) {
        try {
          const supabase = createClient()
          
          // Exchange the code for a session
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('Code exchange error:', error)
            router.replace(`/?error=auth_failed`)
            return
          }

          // Verify session was established
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser()

          if (userError || !user) {
            console.error('Get user error:', userError)
            router.replace(`/?error=session_failed`)
            return
          }

          // Success - redirect to dashboard
          router.replace(next)
        } catch (error) {
          console.error('Auth callback exception:', error)
          router.replace(`/?error=exception`)
        }
      } else {
        // No code, check if already authenticated
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          router.replace(next)
        } else {
          router.replace('/')
        }
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

