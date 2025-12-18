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

