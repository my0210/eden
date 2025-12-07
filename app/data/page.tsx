import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import AppleHealthUpload from '../dashboard/AppleHealthUpload'

export default async function DataPage() {
  const user = await requireAuth()

  return (
    <main className="min-h-screen bg-white">
      {/* Top Navigation */}
      <header className="border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">E</span>
              </div>
              <span className="font-semibold text-gray-900">Eden</span>
            </div>
            <nav className="flex gap-1">
              <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-full">
                Dashboard
              </Link>
              <Link href="/chat" className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-full">
                Chat
              </Link>
              <Link href="/data" className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-gray-100 rounded-full">
                Data
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Data Sources</h1>

        {/* Apple Health Card */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">Apple Health</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Export your health data from iPhone and upload the .zip file here.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Health app → Profile → Export All Health Data
                </p>
              </div>
            </div>
            
            <AppleHealthUpload userId={user.id} />
          </div>
        </div>

        {/* Coming Soon */}
        <div className="rounded-2xl border border-dashed border-gray-300 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-600">Labs &amp; Wearables</h2>
              <p className="text-sm text-gray-400 mt-1">
                More integrations coming soon.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}

