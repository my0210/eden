# PR 1A - Database + Storage Setup

## ✅ Completed

### Database Schema
- ✅ `eden_photo_uploads` table created with RLS
- ✅ `apple_health_imports` extended with new lifecycle columns:
  - `source`, `uploaded_at`, `processing_started_at`, `processed_at`, `failed_at`
  - `error_message`, `metadata_json`
- ✅ Status normalized: existing `'pending'` records updated to `'uploaded'`
- ✅ `get_pending_imports()` function updated to query `'uploaded'` status

### Storage Policies
- ✅ All storage policies for `body_photos` bucket created and applied
- Policies enforce user-specific folders: `${user_id}/${uuid}.${ext}`

## ⚠️ Manual Step Required

### Create Storage Bucket

The `body_photos` bucket needs to be created manually in the Supabase UI:

1. Go to your Supabase project: https://supabase.com/dashboard/project/sqmxrojbhcqgbyrjnihd
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure:
   - **Name**: `body_photos`
   - **Public bucket**: ❌ **Unchecked** (private)
   - **File size limit**: Leave default or set as needed
   - **Allowed MIME types**: Leave empty or restrict to image types (e.g., `image/jpeg,image/png`)
5. Click **"Create bucket"**

The storage policies are already in place and will automatically apply once the bucket is created.

## Verification

### Database Tables
- ✅ `eden_photo_uploads` - Verified with RLS enabled
- ✅ `apple_health_imports` - Verified with new columns

### Storage Policies
All policies verified:
- ✅ `body_photos read own`
- ✅ `body_photos insert own`
- ✅ `body_photos update own`
- ✅ `body_photos delete own`

## Next Steps

Once the bucket is created, the photo upload pipeline will be ready to use. The storage policies ensure:
- Users can only access files in their own folder (`${user_id}/`)
- All operations (read, insert, update, delete) are restricted to authenticated users' own files

