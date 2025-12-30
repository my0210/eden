-- Storage policies for lab_reports bucket
-- Users can only access their own files (stored in user_id/ subfolder)

-- Allow users to upload their own lab reports
CREATE POLICY "Users can upload their own lab reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lab_reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own lab reports
CREATE POLICY "Users can read their own lab reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lab_reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own lab reports
CREATE POLICY "Users can delete their own lab reports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lab_reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own lab reports
CREATE POLICY "Users can update their own lab reports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lab_reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

