'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()
  
  // Listen for auth state changes - this catches ALL auth events including magic links
  useEffect(() => {
    const supabase = createClient()
    
    // Check if already logged in on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsRedirecting(true)
        router.replace('/dashboard')
      } else {
        setIsCheckingAuth(false)
      }
    })
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setIsRedirecting(true)
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
  
  // Show loading screen while checking auth or redirecting
  if (isCheckingAuth || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          {/* Animated logo/icon */}
          <div className="relative mb-8">
            <div className="w-16 h-16 mx-auto">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                className="w-full h-full animate-pulse"
              >
                <circle 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="url(#gradient)" 
                  strokeWidth="2"
                  className="opacity-20"
                />
                <path 
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                  fill="url(#gradient)"
                  className="opacity-90"
                />
                <path 
                  d="M8 12l3 3 5-6" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={isRedirecting ? "opacity-100" : "opacity-0"}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            {/* Spinning ring */}
            {!isRedirecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 border-2 border-transparent border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
          
          {/* Text */}
          <h1 className="text-2xl font-semibold text-white mb-2">
            Eden
          </h1>
          <p className="text-slate-400 text-sm">
            {isRedirecting ? 'Welcome back' : 'Loading'}
            <span className="inline-flex ml-1">
              <span className="animate-bounce delay-0">.</span>
              <span className="animate-bounce delay-100">.</span>
              <span className="animate-bounce delay-200">.</span>
            </span>
          </p>
        </div>
      </div>
    )
  }
  
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
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Sending...' : 'Login with email'}
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

