'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { initializeMemory } from '@/lib/coaching/initializeMemory'

export async function completeOnboarding(userId: string) {
  const supabase = await createClient()
  
  // Update onboarding status
  await supabase
    .from('eden_user_state')
    .update({
      onboarding_status: 'completed',
      onboarding_step: 8,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  
  // Initialize user memory from onboarding data
  try {
    await initializeMemory(supabase, userId)
  } catch (error) {
    console.error('Failed to initialize memory:', error)
    // Don't block onboarding completion if memory init fails
  }
  
  redirect('/chat')
}

