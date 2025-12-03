'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  
  // Handle magic link callback if code is present in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const error = urlParams.get('error')
      
      if (error) {
        const details = urlParams.get('details')
        const errorMessage = details 
          ? `Authentication failed: ${error}. Details: ${decodeURIComponent(details)}`
          : `Authentication failed: ${error}. Please try again.`
        setMessage(errorMessage)
        // Clean up the URL
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
      
      if (code) {
        // Supabase redirects to root with code
        // For magic links, Supabase should create session automatically
        // Just redirect to callback which will check for session
        router.replace(`/auth/callback?code=${code}&next=/dashboard`)
      }
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
      // Construct the redirect URL properly - ensure it's a valid absolute URL
      const origin = window.location.origin
      const redirectUrl = `${origin}/auth/callback?next=/dashboard`
      
      // Validate the URL is properly formed
      new URL(redirectUrl) // This will throw if malformed
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
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

