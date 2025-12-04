'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isProcessingAuth, setIsProcessingAuth] = useState(false)
  const router = useRouter()
  
  // Handle magic link callback - MUST be client-side for PKCE
  useEffect(() => {
    const handleAuthCallback = async () => {
      if (typeof window === 'undefined') return
      
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const errorParam = urlParams.get('error')
      
      // Handle errors from previous attempts
      if (errorParam) {
        const details = urlParams.get('details')
        const errorMessage = details 
          ? `Authentication failed: ${errorParam}. Details: ${decodeURIComponent(details)}`
          : `Authentication failed: ${errorParam}. Please try again.`
        setMessage(errorMessage)
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
      
      // If there's a code, exchange it for a session CLIENT-SIDE
      // This is critical - PKCE code verifier is in localStorage, only accessible client-side
      if (code) {
        setIsProcessingAuth(true)
        setMessage('Signing you in...')
        
        try {
          const supabase = createClient()
          
          // Exchange the code for a session - client-side has access to PKCE code verifier
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('Code exchange error:', error)
            setMessage(`Authentication failed: ${error.message}`)
            window.history.replaceState({}, '', window.location.pathname)
            setIsProcessingAuth(false)
            return
          }
          
          if (data.session) {
            // Success! Redirect to dashboard
            router.replace('/dashboard')
            return
          }
        } catch (err) {
          console.error('Auth exception:', err)
          setMessage('An error occurred during sign in. Please try again.')
          window.history.replaceState({}, '', window.location.pathname)
          setIsProcessingAuth(false)
        }
      }
      
      // Check if already logged in
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/dashboard')
      }
    }
    
    handleAuthCallback()
  }, [router])
  
  // Create client only when needed (client-side only)
  const getSupabaseClient = () => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      return createClient()
    } catch (error) {
      return null
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = getSupabaseClient()
    if (!supabase) {
      setMessage('Supabase client is not available. Please check your configuration.')
      setLoading(false)
      return
    }

    try {
      // Redirect back to root - we handle auth client-side there
      const origin = window.location.origin
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Redirect to root - we'll handle the code exchange client-side
          emailRedirectTo: origin,
        },
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Check your email for the magic link!')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Welcome to Eden
          </h1>
          <p className="text-gray-600 mb-8 text-center">
            Sign in with your email to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading || isProcessingAuth}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isProcessingAuth ? 'Signing in...' : loading ? 'Sending...' : 'Login with email'}
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                message.includes('Check your email')
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

