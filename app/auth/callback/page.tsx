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

      if (code) {
        try {
          const supabase = createClient()
          
          // Verify environment variables are available
          if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            console.error('Missing Supabase environment variables')
            router.replace(`/?error=config_error&details=Missing environment variables`)
            return
          }
          
          console.log('Processing magic link callback with code:', code.substring(0, 20) + '...')
          
          // First, check if session already exists (Supabase might have created it automatically)
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (session && session.user) {
            console.log('Session already exists, redirecting to dashboard')
            router.replace(next)
            return
          }
          
          // If no session, the code from magic links needs to be verified
          // Magic link codes are token hashes that need verification
          // Try to verify the OTP token
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: code,
            type: 'magiclink',
          })
          
          if (verifyError) {
            console.error('OTP verification error:', verifyError)
            
            // If verifyOtp fails, check if user exists anyway (session might be in cookies)
            const { data: { user: checkUser }, error: userCheckError } = await supabase.auth.getUser()
            if (checkUser) {
              console.log('User found despite verification error, redirecting')
              router.replace(next)
              return
            }
            
            router.replace(`/?error=auth_failed&details=${encodeURIComponent(verifyError.message)}`)
            return
          }
          
          console.log('OTP verification successful:', verifyData)

          // Verify session was established after verification
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

