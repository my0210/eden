import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import AppleHealthUpload from '../dashboard/AppleHealthUpload'
import ProfileMenu from '../dashboard/ProfileMenu'

export default async function DataPage() {
  const user = await requireAuth()

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-semibold">Eden</Link>
            <nav className="flex gap-6">
              <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">Dashboard</Link>
              <Link href="/chat" className="text-sm text-white/50 hover:text-white">Chat</Link>
              <Link href="/data" className="text-sm text-white">Data</Link>
            </nav>
          </div>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8">Data Sources</h1>

        {/* Apple Health */}
        <div className="rounded-2xl bg-[#141414] border border-white/5 p-6 mb-4">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium mb-1">Apple Health</h2>
              <p className="text-sm text-white/50">
                Export your health data from iPhone and upload the .zip file.
              </p>
              <p className="text-xs text-white/30 mt-1">
                Health app → Profile → Export All Health Data
              </p>
            </div>
          </div>
          <AppleHealthUpload userId={user.id} />
        </div>

        {/* Coming Soon */}
        <div className="rounded-2xl bg-[#141414] border border-dashed border-white/10 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-white/50 mb-1">Labs &amp; Wearables</h2>
              <p className="text-sm text-white/30">Coming soon</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/20 text-center mt-12">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
