'use client'

import { ReactNode } from 'react'

interface UploadCardProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  status?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export default function UploadCard({ title, subtitle, icon, status, children, footer }: UploadCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-[#F2F2F7] flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-semibold text-black">{title}</h2>
                {subtitle && <p className="text-[15px] text-[#8E8E93] mt-0.5">{subtitle}</p>}
              </div>
              {status && <div className="flex-shrink-0">{status}</div>}
            </div>
          </div>
        </div>

        {children}
      </div>

      {footer && <div className="h-px bg-[#C6C6C8] mx-4" />}
      {footer && <div className="px-4 py-3 bg-[#F2F2F7]">{footer}</div>}
    </div>
  )
}

