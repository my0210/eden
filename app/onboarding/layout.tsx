import { requireAuth } from '@/lib/auth'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  )
}

