-- Better timestamp management for photos and labs
-- Separates upload_date from measurement/object date

-- 1) Add taken_at to photo uploads (when the photo was taken, not uploaded)
ALTER TABLE public.eden_photo_uploads
  ADD COLUMN IF NOT EXISTS taken_at DATE,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: set uploaded_at from created_at for existing records
UPDATE public.eden_photo_uploads
SET uploaded_at = created_at
WHERE uploaded_at IS NULL;

-- Add index for date-based queries (trends)
CREATE INDEX IF NOT EXISTS idx_photo_uploads_taken_at 
  ON public.eden_photo_uploads(taken_at DESC NULLS LAST);

-- 2) Ensure lab_date is indexed for trend queries
CREATE INDEX IF NOT EXISTS idx_lab_uploads_lab_date 
  ON public.eden_lab_uploads(lab_date DESC NULLS LAST);

-- 3) Add uploaded_at to lab uploads for clarity (vs created_at which is system timestamp)
ALTER TABLE public.eden_lab_uploads
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill
UPDATE public.eden_lab_uploads
SET uploaded_at = created_at
WHERE uploaded_at IS NULL;

-- Comments for documentation
COMMENT ON COLUMN public.eden_photo_uploads.taken_at IS 'Date when photo was taken (user-specified or from EXIF). Nullable - defaults to upload date if not specified.';
COMMENT ON COLUMN public.eden_photo_uploads.uploaded_at IS 'When the file was uploaded to Eden.';
COMMENT ON COLUMN public.eden_lab_uploads.lab_date IS 'Date of the lab test (extracted from report). Format: YYYY-MM-DD or YYYY-MM.';
COMMENT ON COLUMN public.eden_lab_uploads.uploaded_at IS 'When the lab report was uploaded to Eden.';

