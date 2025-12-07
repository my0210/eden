'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ProfileMenuProps {
  email: string
}

export default function ProfileMenu({ email }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center"
        aria-label="Account menu"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-lg overflow-hidden z-50 border border-[#C6C6C8]">
          <div className="px-4 py-3 bg-[#F2F2F7]">
            <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide">Account</p>
            <p className="text-[15px] text-black truncate mt-0.5">{email}</p>
          </div>
          <div className="h-px bg-[#C6C6C8]" />
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-[17px] text-[#FF3B30] hover:bg-[#F2F2F7] active:bg-[#E5E5EA] transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
