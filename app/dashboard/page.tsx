import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getUserSnapshot, UserSnapshot } from '@/lib/context/getUserSnapshot'
import ProfileMenu from './ProfileMenu'

const categories = [
  { key: 'heart', label: 'Heart', icon: '♥' },
  { key: 'frame', label: 'Frame', icon: '◼' },
  { key: 'metabolism', label: 'Metabolism', icon: '⚡' },
  { key: 'recovery', label: 'Recovery', icon: '☾' },
  { key: 'mind', label: 'Mind', icon: '◉' },
] as const

export default async function DashboardPage() {
  const { user } = await requireOnboardedUser()
  const supabase = await createClient()

  let snapshot = null
  try {
    snapshot = await getUserSnapshot(supabase, user.id)
  } catch (e) {
    console.error('Failed to build snapshot', e)
  }

  // TODO: Replace with Prime Snapshot v2 scores when available
  // Legacy score computation removed - will use Prime Snapshot v2 in future update

  // Group metrics by category (for display only, no scores)
  const metricsByCategory: Record<string, Array<{ name: string; value: number | null; unit: string | null }>> = {
    heart: [], frame: [], metabolism: [], recovery: [], mind: []
  }
  
  if (snapshot?.metrics) {
    for (const m of snapshot.metrics) {
      if (m.categoryCode && metricsByCategory[m.categoryCode]) {
        metricsByCategory[m.categoryCode].push({
          name: m.metricName || m.metricCode || 'Unknown',
          value: m.latestValue,
          unit: m.unit,
        })
      }
    }
  }
  
  const hasData = snapshot?.metrics && snapshot.metrics.length > 0

  return (
    <main className="min-h-screen bg-[#F2F2F7]">
      {/* Navigation - Apple style */}
      <header className="bg-[#F2F2F7]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/chat" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Eden</Link>
            <Link href="/dashboard" className="text-[17px] font-semibold text-[#007AFF]">Dashboard</Link>
            <Link href="/data" className="text-[17px] text-[#3C3C43]/60 hover:text-[#007AFF]">Data</Link>
          </nav>
          <ProfileMenu email={user.email || ''} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Prime Snapshot Placeholder */}
        <div className="bg-white rounded-xl shadow-sm mb-4">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-black">Prime Snapshot</h2>
                <p className="text-[13px] text-[#8E8E93]">Your health across 5 dimensions</p>
              </div>
            </div>
            
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 text-[15px] text-[#8E8E93]">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Domain scores coming soon with Prime Snapshot v2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {categories.map((cat, idx) => {
            const metrics = metricsByCategory[cat.key]

            return (
              <div key={cat.key}>
                {idx > 0 && <div className="h-px bg-[#C6C6C8] mx-4" />}
                <div className="px-4 py-3">
                  {/* Category header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[17px] font-semibold text-black">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[22px] font-bold text-[#8E8E93] tabular-nums">—</span>
                    </div>
                  </div>
                  
                  {/* Metrics */}
                  {metrics.length > 0 ? (
                    <div className="space-y-1 ml-8">
                      {metrics.map((m, mIdx) => (
                        <div key={mIdx} className="flex items-center justify-between">
                          <span className="text-[15px] text-[#8E8E93]">{m.name}</span>
                          <span className="text-[15px] text-[#3C3C43] tabular-nums">
                            {m.value !== null ? (
                              <>
                                {m.value}
                                {m.unit && <span className="text-[#8E8E93] ml-1">{m.unit}</span>}
                              </>
                            ) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#8E8E93] ml-8">No data yet</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!hasData && (
          <div className="mt-4 bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-[15px] text-[#8E8E93]">
              <Link href="/data" className="text-[#007AFF]">Import data</Link> to see your health metrics.
            </p>
          </div>
        )}

        <p className="text-[11px] text-[#8E8E93] text-center mt-8">
          Eden is not a medical service. Consult a professional for health concerns.
        </p>
      </div>
    </main>
  )
}
