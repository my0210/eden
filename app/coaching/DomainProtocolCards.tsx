'use client'

import Link from 'next/link'
import { PrimeDomain } from '@/lib/prime-scorecard/types'

export interface DomainProtocol {
  id: string
  goal_id: string
  domain: PrimeDomain
  priority: number
  goal_type: 'domain' | 'outcome'
  target_description: string
  duration_weeks: number
  started_at: string | null
  protocol_version: number
  focus_summary: string | null
  template_id: string | null
  current_phase: number
  total_phases: number
  domain_score: number | null
  week_adherence: number | null
}

interface DomainSelection {
  primary: string
  secondary?: string | null
  time_budget_hours?: number
}

interface DomainProtocolCardsProps {
  protocols: DomainProtocol[]
  domainSelection?: DomainSelection | null
}

const DOMAIN_CONFIG: Record<PrimeDomain, { 
  name: string
  color: string
  bgColor: string
  gradient: string
  icon: React.ReactNode
}> = {
  heart: {
    name: 'Heart',
    color: '#FF2D55',
    bgColor: 'bg-[#FF2D55]',
    gradient: 'from-[#FF2D55] to-[#FF6482]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  },
  frame: {
    name: 'Frame',
    color: '#5856D6',
    bgColor: 'bg-[#5856D6]',
    gradient: 'from-[#5856D6] to-[#7B79E8]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  },
  metabolism: {
    name: 'Metabolism',
    color: '#FF9500',
    bgColor: 'bg-[#FF9500]',
    gradient: 'from-[#FF9500] to-[#FFAD33]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
  recovery: {
    name: 'Recovery',
    color: '#34C759',
    bgColor: 'bg-[#34C759]',
    gradient: 'from-[#34C759] to-[#5BD778]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
  },
  mind: {
    name: 'Mind',
    color: '#007AFF',
    bgColor: 'bg-[#007AFF]',
    gradient: 'from-[#007AFF] to-[#3395FF]',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  },
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Primary',
  2: 'Secondary',
  3: 'Tertiary',
}

export default function DomainProtocolCards({ protocols, domainSelection }: DomainProtocolCardsProps) {
  if (protocols.length === 0) {
    // Show selected focus areas if they exist
    if (domainSelection?.primary) {
      const primaryConfig = DOMAIN_CONFIG[domainSelection.primary as PrimeDomain]
      const secondaryConfig = domainSelection.secondary 
        ? DOMAIN_CONFIG[domainSelection.secondary as PrimeDomain] 
        : null

      return (
        <div className="space-y-4">
          <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide px-1">
            Your Focus Areas
          </h2>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Primary Focus */}
            <div className={`bg-gradient-to-r ${primaryConfig?.gradient || 'from-[#007AFF] to-[#3395FF]'} p-4 text-white`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {primaryConfig?.icon}
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-white/70 uppercase tracking-wide">Primary Focus</p>
                  <h3 className="text-[20px] font-semibold">{primaryConfig?.name || domainSelection.primary}</h3>
                </div>
              </div>
            </div>

            {/* Secondary Focus (if exists) */}
            {secondaryConfig && (
              <div className="p-4 border-b border-[#E5E5EA]">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${secondaryConfig.color}15` }}
                  >
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke={secondaryConfig.color} 
                      viewBox="0 0 24 24"
                    >
                      {secondaryConfig.icon}
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Secondary Focus</p>
                    <h4 className="text-[17px] font-medium text-black">{secondaryConfig.name}</h4>
                  </div>
                </div>
              </div>
            )}

            {/* Status & CTA */}
            <div className="p-4 bg-[#FFF9E6]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FF9500]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[15px] font-medium text-black">Ready to create your protocol</p>
                  <p className="text-[13px] text-[#8E8E93] mt-1">
                    Chat with Eden to personalize your plan based on your schedule and preferences.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="p-4 pt-0">
              <Link
                href="/chat"
                className="flex items-center justify-center gap-2 w-full bg-[#007AFF] text-white py-3 rounded-xl text-[17px] font-medium hover:bg-[#0066CC] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Continue with Eden
              </Link>
            </div>
          </div>

          {/* Link to change focus areas */}
          <p className="text-center">
            <Link href="/data" className="text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors">
              Change focus areas →
            </Link>
          </p>
        </div>
      )
    }

    // No selection and no protocols - completely empty state
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-[#FF9500]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-[22px] font-semibold text-black mb-2">No Active Protocols</h2>
        <p className="text-[15px] text-[#8E8E93] mb-6 max-w-sm mx-auto">
          Chat with Eden to set up your personalized domain protocols.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 bg-[#007AFF] text-white px-6 py-3 rounded-full text-[17px] font-medium hover:bg-[#0066CC] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Start with Eden
        </Link>
      </div>
    )
  }

  // Sort by priority
  const sortedProtocols = [...protocols].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-4">
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide px-1">
        Your Focus Domains
      </h2>
      
      <div className="grid gap-4">
        {sortedProtocols.map((protocol) => {
          const config = DOMAIN_CONFIG[protocol.domain]
          const weeksIn = protocol.started_at 
            ? Math.ceil((Date.now() - new Date(protocol.started_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
            : 0

          return (
            <div
              key={protocol.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${config.gradient} p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {config.icon}
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[17px] font-semibold">{config.name}</h3>
                      <p className="text-[13px] text-white/80">
                        {PRIORITY_LABELS[protocol.priority] || `Priority ${protocol.priority}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Score Badge */}
                  {protocol.domain_score !== null && (
                    <div className="bg-white/20 rounded-lg px-3 py-1">
                      <span className="text-[20px] font-bold">{protocol.domain_score}</span>
                      <span className="text-[13px] text-white/80">/100</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Focus Summary */}
                {protocol.focus_summary && (
                  <p className="text-[14px] text-[#3C3C43] leading-relaxed">
                    {protocol.focus_summary}
                  </p>
                )}

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-[13px]">
                  {/* Week Progress */}
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[#8E8E93]">
                      Week {weeksIn} of {protocol.duration_weeks}
                    </span>
                  </div>

                  {/* Phase */}
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-[#8E8E93]">
                      Phase {protocol.current_phase}/{protocol.total_phases}
                    </span>
                  </div>

                  {/* Adherence */}
                  {protocol.week_adherence !== null && (
                    <div className="flex items-center gap-1.5">
                      <div 
                        className={`w-2 h-2 rounded-full ${
                          protocol.week_adherence >= 80 ? 'bg-[#34C759]' :
                          protocol.week_adherence >= 50 ? 'bg-[#FF9500]' :
                          'bg-[#FF3B30]'
                        }`}
                      />
                      <span className="text-[#8E8E93]">
                        {protocol.week_adherence}% this week
                      </span>
                    </div>
                  )}
                </div>

                {/* Version Link */}
                <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between">
                  <span className="text-[11px] text-[#8E8E93]">
                    Protocol v{protocol.protocol_version}
                    {protocol.template_id && ` • ${protocol.template_id} template`}
                  </span>
                  <Link
                    href={`/coaching/history?goalId=${protocol.goal_id}`}
                    className="text-[13px] text-[#007AFF] hover:underline"
                  >
                    View history
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

