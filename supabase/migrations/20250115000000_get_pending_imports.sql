-- Function to get pending imports for cron job processing
-- Marked as SECURITY DEFINER so it can bypass RLS when called with anon key
CREATE OR REPLACE FUNCTION get_pending_imports(limit_count INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  file_path TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ahi.id,
    ahi.user_id,
    ahi.file_path,
    ahi.status,
    ahi.created_at
  FROM apple_health_imports ahi
  WHERE ahi.status = 'pending'
  ORDER BY ahi.created_at ASC
  LIMIT limit_count;
END;
$$;

-- Function to get a specific import by ID (for cron job processing)
CREATE OR REPLACE FUNCTION get_import_by_id(import_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  file_path TEXT,
  status TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ahi.id,
    ahi.user_id,
    ahi.file_path,
    ahi.status
  FROM apple_health_imports ahi
  WHERE ahi.id = import_id;
END;
$$;

-- Function to update import status (for cron job processing)
CREATE OR REPLACE FUNCTION update_import_status(
  import_id UUID,
  new_status TEXT,
  error_msg TEXT DEFAULT NULL,
  processed_at_val TIMESTAMPTZ DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE apple_health_imports
  SET 
    status = new_status,
    error_message = error_msg,
    processed_at = COALESCE(processed_at_val, CASE WHEN new_status = 'completed' THEN NOW() ELSE processed_at END),
    updated_at = NOW()
  WHERE id = import_id;
END;
$$;

-- Grant execute permissions to anon role
GRANT EXECUTE ON FUNCTION get_pending_imports(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_import_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_import_status(UUID, TEXT, TEXT, TIMESTAMPTZ) TO anon;

