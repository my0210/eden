'use client'

import { useState, useEffect } from 'react'
import { PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types'

interface DomainSelection {
  primary: string
  secondary?: string | null
  time_budget_hours: number
}

const DOMAIN_COLORS: Record<PrimeDomain, string> = {
  heart: '#FF2D55',
  frame: '#5856D6',
  metabolism: '#FF9500',
  recovery: '#34C759',
  mind: '#007AFF',
}

const DOMAIN_LABELS: Record<PrimeDomain, string> = {
  heart: 'Heart',
  frame: 'Frame',
  metabolism: 'Metabolism',
  recovery: 'Recovery',
  mind: 'Mind',
}

const DOMAIN_DESCRIPTIONS: Record<PrimeDomain, string> = {
  heart: 'Cardiovascular health & endurance',
  frame: 'Strength, mobility & body composition',
  metabolism: 'Energy, nutrition & metabolic health',
  recovery: 'Sleep quality & stress management',
  mind: 'Focus, clarity & cognitive function',
}

export default function FocusAreasSection() {
  const [selection, setSelection] = useState<DomainSelection | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Edit state
  const [editPrimary, setEditPrimary] = useState<PrimeDomain | null>(null)
  const [editSecondary, setEditSecondary] = useState<PrimeDomain | null>(null)
  const [editTimeBudget, setEditTimeBudget] = useState(5)

  useEffect(() => {
    loadSelection()
  }, [])

  async function loadSelection() {
    try {
      const res = await fetch('/api/user/focus-areas')
      if (res.ok) {
        const data = await res.json()
        if (data.domain_selection) {
          setSelection(data.domain_selection)
          setEditPrimary(data.domain_selection.primary as PrimeDomain)
          setEditSecondary(data.domain_selection.secondary as PrimeDomain | null)
          setEditTimeBudget(data.domain_selection.time_budget_hours || 5)
        }
      }
    } catch (err) {
      console.error('Failed to load focus areas:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!editPrimary) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/user/focus-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary: editPrimary,
          secondary: editSecondary,
          time_budget_hours: editTimeBudget,
        }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setSelection(data.domain_selection)
        setEditing(false)
      }
    } catch (err) {
      console.error('Failed to save focus areas:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setEditPrimary(selection?.primary as PrimeDomain || null)
    setEditSecondary(selection?.secondary as PrimeDomain | null || null)
    setEditTimeBudget(selection?.time_budget_hours || 5)
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-[#E5E5EA] rounded w-32 mb-4" />
          <div className="h-16 bg-[#F2F2F7] rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">
        Focus Areas
      </h2>
      
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!selection && !editing ? (
          // No selection yet
          <div className="p-6 text-center">
            <p className="text-[15px] text-[#8E8E93] mb-3">
              No focus areas selected yet
            </p>
            <button
              onClick={() => setEditing(true)}
              className="text-[15px] text-[#007AFF] font-medium hover:underline"
            >
              Choose your focus areas
            </button>
          </div>
        ) : editing ? (
          // Edit mode
          <div className="p-6 space-y-5">
            {/* Primary selection */}
            <div>
              <label className="block text-[13px] font-semibold text-black mb-2">
                Primary Focus
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRIME_DOMAINS.map((domain) => (
                  <button
                    key={domain}
                    onClick={() => {
                      setEditPrimary(domain)
                      if (editSecondary === domain) setEditSecondary(null)
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      editPrimary === domain
                        ? 'border-[#007AFF] bg-[#007AFF]/5'
                        : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                      />
                      <span className="text-[15px] font-medium text-black">
                        {DOMAIN_LABELS[domain]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary selection */}
            <div>
              <label className="block text-[13px] font-semibold text-black mb-2">
                Secondary Focus <span className="font-normal text-[#8E8E93]">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRIME_DOMAINS.filter(d => d !== editPrimary).map((domain) => (
                  <button
                    key={domain}
                    onClick={() => setEditSecondary(editSecondary === domain ? null : domain)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      editSecondary === domain
                        ? 'border-[#007AFF] bg-[#007AFF]/5'
                        : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                      />
                      <span className="text-[15px] font-medium text-black">
                        {DOMAIN_LABELS[domain]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time budget */}
            <div>
              <label className="block text-[13px] font-semibold text-black mb-2">
                Weekly Time Budget
              </label>
              <div className="flex gap-2">
                {[3, 5, 7, 10].map((hours) => (
                  <button
                    key={hours}
                    onClick={() => setEditTimeBudget(hours)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[15px] font-medium transition-colors ${
                      editTimeBudget === hours
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-[#F2F2F7] text-black hover:bg-[#E5E5EA]'
                    }`}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 px-4 rounded-xl text-[15px] font-medium text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editPrimary || saving}
                className="flex-1 py-2.5 px-4 rounded-xl text-[15px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          // View mode
          <div className="divide-y divide-[#E5E5EA]">
            {/* Primary */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${DOMAIN_COLORS[selection.primary as PrimeDomain]}15` }}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: DOMAIN_COLORS[selection.primary as PrimeDomain] }}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Primary Focus</p>
                  <p className="text-[17px] font-semibold text-black">
                    {DOMAIN_LABELS[selection.primary as PrimeDomain]}
                  </p>
                  <p className="text-[13px] text-[#8E8E93]">
                    {DOMAIN_DESCRIPTIONS[selection.primary as PrimeDomain]}
                  </p>
                </div>
              </div>
            </div>

            {/* Secondary */}
            {selection.secondary && (
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${DOMAIN_COLORS[selection.secondary as PrimeDomain]}15` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: DOMAIN_COLORS[selection.secondary as PrimeDomain] }}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Secondary Focus</p>
                    <p className="text-[17px] font-semibold text-black">
                      {DOMAIN_LABELS[selection.secondary as PrimeDomain]}
                    </p>
                    <p className="text-[13px] text-[#8E8E93]">
                      {DOMAIN_DESCRIPTIONS[selection.secondary as PrimeDomain]}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Time budget */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F2F2F7] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Time Budget</p>
                  <p className="text-[17px] font-semibold text-black">
                    {selection.time_budget_hours} hours/week
                  </p>
                </div>
              </div>
            </div>

            {/* Edit button */}
            <div className="p-4">
              <button
                onClick={() => setEditing(true)}
                className="w-full py-2.5 rounded-xl text-[15px] font-medium text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 transition-colors"
              >
                Change Focus Areas
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

