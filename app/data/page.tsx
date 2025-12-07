import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import AppleHealthUpload from '../dashboard/AppleHealthUpload'
import ProfileMenu from '../dashboard/ProfileMenu'
import ResetUserDataCard from './ResetUserDataCard'

export default async function DataPage() {
  const user = await requireAuth()

  return (
    <main className="min-h-screen bg-[#F2F2F7]">
      {/* Navigation - Apple style */}
      <header className="bg-[#F2F2F7]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/chat" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Eden</Link>
            <Link href="/dashboard" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Dashboard</Link>
            <Link href="/data" className="text-[17px] font-semibold text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">Data Sources</h1>

        {/* Apple Health Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#FF2D55] to-[#FF375F] flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-semibold text-black">Apple Health</h2>
                <p className="text-[15px] text-[#8E8E93] mt-0.5">
                  Import your health data from iPhone
                </p>
              </div>
            </div>
            <AppleHealthUpload userId={user.id} />
          </div>
          <div className="h-px bg-[#C6C6C8] mx-4" />
          <div className="px-4 py-3 bg-[#F2F2F7]">
            <p className="text-[13px] text-[#8E8E93]">
              On iPhone: Health → Profile → Export All Health Data
            </p>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E5E5EA] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#8E8E93]">Labs &amp; Wearables</h2>
                <p className="text-[15px] text-[#AEAEB2] mt-0.5">Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Tools */}
        <ResetUserDataCard />

        <p className="text-[11px] text-[#8E8E93] text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
