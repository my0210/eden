'use client'

import Link from 'next/link'

type BottomNavProps = {
  active: 'chat' | 'dashboard'
}

export default function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        <Link
          href="/chat"
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
            active === 'chat' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={active === 'chat' ? 2 : 1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="text-xs font-medium">Chat</span>
        </Link>

        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
            active === 'dashboard' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={active === 'dashboard' ? 2 : 1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-xs font-medium">Dashboard</span>
        </Link>
      </div>
    </nav>
  )
}

