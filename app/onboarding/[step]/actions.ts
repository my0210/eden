'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function completeOnboarding(userId: string) {
  const supabase = await createClient()
  await supabase
    .from('eden_user_state')
    .update({
      onboarding_status: 'completed',
      onboarding_step: 8,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  redirect('/chat')
}

