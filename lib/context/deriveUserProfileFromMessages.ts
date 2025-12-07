import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function deriveUserProfileFromMessages(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // 1) First get the user's conversation(s)
  const { data: conversations, error: convError } = await supabase
    .from('eden_conversations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (convError) {
    console.error('deriveUserProfileFromMessages: convError', convError)
    return
  }

  if (!conversations || conversations.length === 0) return

  const conversationId = conversations[0].id

  // 2) Fetch recent messages from that conversation
  const { data: messages, error: messagesError } = await supabase
    .from('eden_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(30)

  if (messagesError) {
    console.error('deriveUserProfileFromMessages: messagesError', messagesError)
    return
  }

  if (!messages || messages.length === 0) return

  // 3) Get current profile row (or create one)
  const { data: existingProfile, error: profileError } = await supabase
    .from('eden_user_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('deriveUserProfileFromMessages: profileError', profileError)
  }

  let profile = existingProfile

  if (!profile) {
    const { data: inserted, error: insertError } = await supabase
      .from('eden_user_profile')
      .insert({ user_id: userId })
      .select('*')
      .single()

    if (insertError) {
      console.error('deriveUserProfileFromMessages: insertError', insertError)
      return
    }

    profile = inserted
  }

  // 4) Ask OpenAI to extract profile fields from the conversation
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You extract a health coaching profile from a conversation. Return ONLY a JSON object with these possible keys:
- age (integer)
- sex_at_birth (string: "male" or "female")
- height_cm (integer)
- weight_kg (number)
- primary_goal (string: brief description of their main health/fitness goal)
- first_name (string)

Use null for anything you cannot infer confidently from what the user explicitly stated. Do not guess or assume. Do not include any natural language explanation.`,
      },
      {
        role: 'user',
        content: `Here are recent messages between Eden (assistant) and the user:\n${JSON.stringify(messages)}`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'

  let patch: Record<string, unknown> = {}
  try {
    patch = JSON.parse(raw)
  } catch (e) {
    console.error('deriveUserProfileFromMessages: failed to parse JSON', raw, e)
    return
  }

  // 5) Build update object with only changed non-null values
  const updateData: Record<string, unknown> = {}

  const maybeCopy = (key: string) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const value = patch[key]
      // Only update if value is not null/undefined and different from current
      if (value !== null && value !== undefined && profile && profile[key] !== value) {
        updateData[key] = value
      }
    }
  }

  // Copy fields that match eden_user_profile columns
  maybeCopy('age')
  maybeCopy('sex_at_birth')
  maybeCopy('height_cm')
  maybeCopy('weight_kg')
  maybeCopy('primary_goal')
  maybeCopy('first_name')

  if (Object.keys(updateData).length === 0) return

  updateData.updated_at = new Date().toISOString()

  console.log('deriveUserProfileFromMessages: updating profile with', updateData)

  // 6) Update the profile
  const { error: updateError } = await supabase
    .from('eden_user_profile')
    .update(updateData)
    .eq('user_id', userId)

  if (updateError) {
    console.error('deriveUserProfileFromMessages: updateError', updateError)
  }
}
