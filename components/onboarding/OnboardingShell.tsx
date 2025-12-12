'use client'

import Link from 'next/link'

interface OnboardingShellProps {
  step: number
  title: string
  subtitle: string
  children: React.ReactNode
  backHref?: string
  nextHref?: string
  nextAction?: () => void | Promise<void>
  showBack?: boolean
  showNext?: boolean
  nextDisabled?: boolean
  nextLabel?: string
}

export default function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  backHref,
  nextHref,
  nextAction,
  showBack = true,
  showNext = true,
  nextDisabled = false,
  nextLabel,
}: OnboardingShellProps) {
  const defaultNextLabel = step === 8 ? 'Complete' : 'Next'
  const displayNextLabel = nextLabel || defaultNextLabel

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[13px] text-[#8E8E93] uppercase tracking-wide">
            Step {step} of 8
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  s <= step ? 'bg-[#007AFF]' : 'bg-[#E5E5EA]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Title and subtitle */}
        <h1 className="text-[28px] font-bold text-black mb-2">{title}</h1>
        <p className="text-[17px] text-[#8E8E93]">{subtitle}</p>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        {children}
      </div>

      {/* Navigation */}
      <div className="px-6 py-4 border-t border-[#E5E5EA] flex items-center justify-between gap-4">
        {showBack && backHref ? (
          <Link
            href={backHref}
            className="text-[17px] text-[#007AFF] font-semibold hover:opacity-70 transition-opacity"
          >
            Back
          </Link>
        ) : (
          <div />
        )}

        {showNext && (
          nextAction ? (
            <form action={nextAction} className="ml-auto">
              <button
                type="submit"
                disabled={nextDisabled}
                className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] disabled:cursor-not-allowed transition-colors"
              >
                {displayNextLabel}
              </button>
            </form>
          ) : nextHref ? (
            <Link
              href={nextHref}
              className="bg-[#007AFF] text-white py-3 px-6 rounded-xl text-[17px] font-semibold hover:bg-[#0066DD] active:bg-[#0055CC] disabled:bg-[#C7C7CC] disabled:cursor-not-allowed transition-colors ml-auto inline-block text-center"
            >
              {displayNextLabel}
            </Link>
          ) : null
        )}
      </div>
    </div>
  )
}

