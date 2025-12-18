# Migration Instructions - PR9A

## Database Migration

Apply the following SQL in your Supabase dashboard:

1. Go to: https://app.supabase.com/project/YOUR_PROJECT/sql/new
2. Paste the SQL below
3. Click "Run"

```sql
-- PR9A: Link metrics to imports for cascade deletion
-- Add import_id to eden_metric_values and update unique constraint

-- Add import_id column with foreign key and cascade delete
alter table public.eden_metric_values
  add column if not exists import_id uuid references public.apple_health_imports(id) on delete cascade;

-- Create index for efficient lookups by import_id
create index if not exists idx_metric_values_import_id
  on public.eden_metric_values(import_id);

-- Drop old unique index if it exists
drop index if exists uniq_metric_user_code_time;

-- Create new unique index for idempotency within the same import
create unique index if not exists uniq_metric_import_code_time
  on public.eden_metric_values (import_id, metric_id, measured_at);

-- Note: import_id can be null for existing rows (backward compatibility)
-- New rows from worker will always have import_id set
```

## Deployment Status

### Vercel (App)
✅ **Auto-deployed** - Code pushed to `main` branch triggers automatic deployment
- Latest commit: `4b0ab5d`
- Check deployment: https://vercel.com/dashboard

### Railway (Worker)
⚠️ **Manual deploy needed** - Railway may need a manual redeploy to pick up changes
1. Go to Railway dashboard
2. Find your apple-health worker service
3. Click "Redeploy" or trigger a new deployment
4. Verify environment variables are set:
   - `EDEN_APP_URL` = `https://eden-jade.vercel.app`
   - `WORKER_SECRET` = (same as Vercel)

## Verification

After migration:
1. Check `eden_metric_values` table has `import_id` column
2. Verify new imports include `import_id` when worker processes them
3. Test delete functionality on `/data` page

