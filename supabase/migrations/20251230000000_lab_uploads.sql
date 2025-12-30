-- Lab Uploads table for storing uploaded lab reports and extracted values
-- =============================================================================

-- Table: eden_lab_uploads
CREATE TABLE IF NOT EXISTS eden_lab_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File info
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- Storage path in Supabase
  file_type TEXT NOT NULL,  -- 'pdf' | 'image'
  file_size_bytes INTEGER,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rejected')),
  
  -- Extracted lab values (stored as JSON for flexibility)
  extracted_values JSONB,  -- { marker_key: { value: number, unit: string, reference_range?: string } }
  
  -- Metadata
  lab_date TEXT,           -- YYYY-MM-DD or YYYY-MM if exact date unknown
  lab_provider TEXT,       -- e.g., "LabCorp", "Quest", extracted if visible
  validation_message TEXT, -- Message if rejected (e.g., "Not a lab report")
  
  -- AI analysis metadata
  analysis_metadata JSONB, -- Raw AI response, confidence scores, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lab_uploads_user_id ON eden_lab_uploads(user_id);
CREATE INDEX idx_lab_uploads_status ON eden_lab_uploads(status);
CREATE INDEX idx_lab_uploads_created_at ON eden_lab_uploads(created_at DESC);

-- RLS Policies
ALTER TABLE eden_lab_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lab uploads"
  ON eden_lab_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lab uploads"
  ON eden_lab_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lab uploads"
  ON eden_lab_uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lab uploads"
  ON eden_lab_uploads FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for lab files
-- Note: Run this in Supabase dashboard or via separate SQL:
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('lab_reports', 'lab_reports', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for lab_reports bucket
-- (Similar to body_photos bucket setup)

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_lab_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lab_uploads_updated_at
  BEFORE UPDATE ON eden_lab_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_uploads_updated_at();

-- Comment on table
COMMENT ON TABLE eden_lab_uploads IS 'Stores user lab report uploads and AI-extracted biomarker values';

