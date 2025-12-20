import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'
import { getUserState, getRedirectPath } from './onboarding/getUserState'

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    redirect('/')
  }
  return user
}

/**
 * Requires authentication AND completed onboarding.
 * Redirects to onboarding if not completed, or home if not authenticated.
 */
export async function requireOnboardedUser() {
  const user = await getUser()
  if (!user) {
    redirect('/')
  }

  const supabase = await createClient()
  const userState = await getUserState(supabase, user.id)

  if (userState.onboarding_status !== 'completed') {
    // Redirect to onboarding step if not completed
    const step = userState.onboarding_step || 1
    redirect(`/onboarding/${Math.max(1, step)}`)
  }

  return { user, userState }
}
