import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Supabase client specifically for Route Handlers
export async function createRouteHandlerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // In Route Handlers, cookies can sometimes be read-only
              // depending on the response state
            }
          })
        },
      },
    }
  )
}

