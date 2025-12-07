'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    const details = searchParams.get('details')
    if (error && details) {
      setMessage(details)
      setIsError(true)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/chat`,
        },
      })

      if (error) {
        setMessage(error.message)
        setIsError(true)
      } else {
        setMessage('Check your email for the magic link!')
        setIsError(false)
      }
    } catch {
      setMessage('An error occurred. Please try again.')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#007AFF] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
          <h1 className="text-[28px] font-bold text-black">Eden</h1>
          <p className="text-[15px] text-[#8E8E93] mt-1">Your health companion</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 text-[17px] text-black bg-[#F2F2F7] border border-[#C6C6C8] rounded-xl focus:border-[#007AFF] focus:ring-0 outline-none transition placeholder:text-[#AEAEB2]"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#007AFF] text-white py-3 px-4 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] transition-colors"
            >
              {loading ? 'Sending…' : 'Continue with Email'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-xl text-[15px] ${
              isError
                ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
                : 'bg-[#34C759]/10 text-[#34C759]'
            }`}>
              {message}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#8E8E93] text-center mt-6">
          Eden is not a medical service.<br />
          Consult a professional for health concerns.
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
