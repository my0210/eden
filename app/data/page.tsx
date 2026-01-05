import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import ProfileMenu from '../dashboard/ProfileMenu'
import ResetUserDataCard from './ResetUserDataCard'
import ProfileSection from './ProfileSection'
import QuickChecksSection from './QuickChecksSection'
import AppleHealthSection from './AppleHealthSection'
import BodyPhotoSection from './BodyPhotoSection'
import LabSection from './LabSection'
import AboutYouSection from './AboutYouSection'

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
            <Link href="/coaching" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Coaching</Link>
            <Link href="/data" className="text-[17px] font-semibold text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* What Eden Knows - Memory */}
          <section>
            <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Eden&apos;s Memory</h2>
            <AboutYouSection />
          </section>

          {/* Profile - Basic info */}
          <ProfileSection />

          {/* Prime Check - Health assessment answers */}
          <QuickChecksSection />

          {/* Apple Health */}
          <AppleHealthSection />

          {/* Body Composition */}
          <BodyPhotoSection />

          {/* Lab Reports */}
          <LabSection />

          {/* Coming Soon - Wearables */}
          <section>
            <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Coming Soon</h2>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-[#E5E5EA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5E5EA] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[#8E8E93]">Wearable Integrations</h3>
                  <p className="text-[14px] text-[#AEAEB2]">Oura, Whoop, and more devices</p>
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
