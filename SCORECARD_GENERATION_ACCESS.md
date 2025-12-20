# Scorecard Generation: Supabase Access Analysis

## Current Implementation

### `/api/internal/scorecard/generate` (Called by Railway Worker)

**Line 48:**
```typescript
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```

**What this means:**
- ✅ **Tries to use** `SUPABASE_SERVICE_ROLE_KEY` if configured
- ⚠️ **Falls back to** `NEXT_PUBLIC_SUPABASE_ANON_KEY` if service role key is missing
- ❌ **Problem**: With anon key, writes will FAIL due to RLS

### RLS Policy on `eden_user_scorecards`

From migration `20251214000000_scorecards_semantics.sql`:
```sql
create policy "Users can manage their own eden_user_scorecards"
on public.eden_user_scorecards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

**This means:**
- RLS requires `auth.uid() = user_id` to write
- `auth.uid()` returns the authenticated user's ID from the session
- **With anon key and no user session**: `auth.uid()` = `null`
- **Result**: Write is BLOCKED by RLS

## The Problem

**If `SUPABASE_SERVICE_ROLE_KEY` is NOT configured in Vercel:**

1. Endpoint falls back to anon key
2. Creates Supabase client with anon key (no user session)
3. Tries to call `supabase.auth.admin.getUserById(userId)` → **FAILS** (admin API requires service role)
4. Tries to insert into `eden_user_scorecards` → **FAILS** (RLS blocks: `auth.uid()` is null)
5. Error is logged but worker continues (non-fatal)

**Result**: Scorecard generation silently fails, no scorecard is created.

## Solution

**Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables:**

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add: `SUPABASE_SERVICE_ROLE_KEY` = (your service role key from Supabase)
3. Get the key from: https://app.supabase.com/project/_/settings/api
4. **Important**: Service role key bypasses RLS, so keep it secret!

## Why Service Role Key is Needed

The internal endpoint needs to:
- Write scorecards for any user (bypass RLS)
- Called by Railway worker (no user session)
- Needs admin privileges to write on behalf of users

Without it, the endpoint cannot write to `eden_user_scorecards` because:
- No user session exists (worker call, not user request)
- RLS policy requires `auth.uid() = user_id`
- Anon key cannot bypass RLS

## Verification

Check if service role key is configured:
- Vercel Dashboard → Environment Variables
- Look for `SUPABASE_SERVICE_ROLE_KEY`
- If missing, that's why scorecard generation fails

## Alternative: Fix RLS Policy

If you don't want to use service role key, you'd need to:
1. Create a function that can write scorecards (bypasses RLS)
2. Or modify RLS to allow writes from specific service accounts
3. But service role key is the standard approach for this use case

