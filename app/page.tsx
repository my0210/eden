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
  
  // Listen for auth state changes - this catches ALL auth events including magic links
  useEffect(() => {
    const supabase = createClient()
    
    // Check if already logged in on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard')
      }
    })
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session) {
        // User signed in successfully - redirect to dashboard
        router.replace('/dashboard')
      }
    })
    
    // Handle URL params (error messages from previous attempts)
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    if (errorParam) {
      const details = urlParams.get('details')
      setMessage(details 
        ? `Authentication failed: ${errorParam}. Details: ${decodeURIComponent(details)}`
        : `Authentication failed: ${errorParam}. Please try again.`)
      window.history.replaceState({}, '', window.location.pathname)
    }
    
    return () => {
      subscription.unsubscribe()
    }
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
      // Don't specify emailRedirectTo - let Supabase use the Site URL
      // This avoids PKCE issues and uses the implicit flow
      const { error } = await supabase.auth.signInWithOtp({
        email,
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

