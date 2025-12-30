import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import ProfileMenu from '../dashboard/ProfileMenu'
import ResetUserDataCard from './ResetUserDataCard'
import AppleHealthSection from './AppleHealthSection'
import BodyPhotoSection from './BodyPhotoSection'

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

        <div className="space-y-6">
          {/* Apple Health Section */}
          <AppleHealthSection />

          {/* Body Photo Section */}
          <BodyPhotoSection />

          {/* Coming Soon */}
          <section>
            <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Coming Soon</h2>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E5E5EA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5E5EA] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[#8E8E93]">Labs &amp; Wearables</h3>
                  <p className="text-[14px] text-[#AEAEB2]">Blood tests, Oura, Whoop, and more</p>
                </div>
              </div>
            </div>
          </section>
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
