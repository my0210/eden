# Apple Health Upload → Dashboard Flow

## Overview

This document explains how Apple Health data flows from upload to dashboard display.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS FILE                                           │
│    Component: AppleHealthUpload.tsx                             │
│    Location: /data page                                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. UPLOAD TO STORAGE                                            │
│    Endpoint: POST /api/uploads/apple-health                      │
│    OR: POST /api/uploads/apple-health/signed-url (large files)  │
│                                                                  │
│    Steps:                                                       │
│    - Upload ZIP to Supabase Storage (apple_health_uploads)     │
│    - Create row in apple_health_imports table                    │
│      • status: 'uploaded'                                        │
│      • file_path: stored in Supabase Storage                     │
│      • user_id: authenticated user                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. RAILWAY WORKER POLLS                                         │
│    Service: Railway Apple Health Worker                          │
│    File: worker/apple-health/src/index.ts                        │
│                                                                  │
│    Loop:                                                        │
│    - Polls apple_health_imports for status='uploaded'            │
│    - Atomically claims one row (optimistic locking)              │
│    - Calls processImport()                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. WORKER PROCESSES IMPORT                                       │
│    File: worker/apple-health/src/processImport.ts                │
│                                                                  │
│    Steps:                                                       │
│    a) Download ZIP from Supabase Storage                        │
│    b) Unzip and find export.xml                                  │
│    c) Stream-parse XML (SAX parser, memory-safe)                  │
│    d) Extract metrics:                                           │
│       • VO2max, Resting HR, HRV, Sleep                           │
│       • Blood Pressure (paired systolic/diastolic)               │
│       • Body Composition (body_mass, body_fat_percentage)        │
│    e) Write metrics to eden_metric_values                        │
│       • Includes import_id (for cascade delete)                  │
│    f) Mark import as 'completed'                                 │
│    g) Trigger scorecard generation (non-blocking)                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. SCORECARD GENERATION (AUTOMATIC)                              │
│    Worker calls: POST /api/internal/scorecard/generate           │
│    Protected by: WORKER_SECRET header                            │
│                                                                  │
│    Steps:                                                       │
│    a) Load all metrics from eden_metric_values                   │
│    b) Load Apple Health import status                            │
│    c) Load photo uploads count                                   │
│    d) Load self-report essentials (age, sex, height, weight)     │
│    e) Compute Prime Scorecard:                                   │
│       • Domain scores (heart, frame, metabolism, recovery, mind)   │
│       • Prime score (average of domain scores)                   │
│       • Confidence scores                                         │
│       • Evidence array                                            │
│    f) Persist to eden_user_scorecards                            │
│    g) Update eden_user_state.latest_scorecard_id                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. UI POLLS FOR UPDATES                                          │
│    Component: AppleHealthUpload.tsx                               │
│                                                                  │
│    Polling:                                                     │
│    - Every 3s when status is 'uploaded'/'processing'            │
│    - Every 10s when status is 'completed'/'failed'                 │
│    - Calls: GET /api/uploads/status                              │
│    - Shows "Prime Scorecard updated" when processing completes   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. DASHBOARD LOADS SCORECARD                                     │
│    Component: DashboardScorecard.tsx                              │
│    Location: /dashboard page                                      │
│                                                                  │
│    On mount:                                                    │
│    - Calls: GET /api/prime-scorecard/latest                     │
│    - Fetches from eden_user_scorecards                           │
│    - Displays via ScorecardView component                        │
│                                                                  │
│    Manual refresh:                                              │
│    - User clicks "Refresh" button                                │
│    - Calls: POST /api/prime-scorecard/generate                   │
│    - Regenerates scorecard from current metrics                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Upload Flow

**Frontend:**
- `components/uploads/AppleHealthUpload.tsx`
  - Handles file selection
  - Uploads via form data (< 4MB) or signed URL (≥ 4MB)
  - Polls status every 3-10s
  - Shows progress and completion status

**Backend:**
- `app/api/uploads/apple-health/route.ts` - Form data upload
- `app/api/uploads/apple-health/signed-url/route.ts` - Get signed URL
- `app/api/uploads/apple-health/confirm/route.ts` - Confirm upload
- `app/api/uploads/status/route.ts` - Get import status

### 2. Worker Processing

**Railway Worker:**
- `worker/apple-health/src/index.ts` - Main loop, polls for imports
- `worker/apple-health/src/claimNextImport.ts` - Atomically claim import
- `worker/apple-health/src/processImport.ts` - Main processing logic
- `worker/apple-health/src/parseExportXml.ts` - Stream-parse XML
- `worker/apple-health/src/writeMetrics.ts` - Write to eden_metric_values
- `worker/apple-health/src/triggerScorecardGeneration.ts` - Call Vercel endpoint

### 3. Scorecard Generation

**Internal Endpoint:**
- `app/api/internal/scorecard/generate/route.ts`
  - Protected by WORKER_SECRET
  - Called by Railway worker after processing
  - Uses service role key to bypass RLS

**Public Endpoint:**
- `app/api/prime-scorecard/generate/route.ts`
  - Called by UI "Refresh" button
  - User-authenticated
  - Has idempotency guard (10 min cache)

**Computation:**
- `lib/prime-scorecard/inputs.ts` - Loads all data (metrics, uploads, self-report)
- `lib/prime-scorecard/compute.ts` - Computes scores from inputs
- `lib/prime-scorecard/metricContribution.ts` - Converts raw values to 0-100 scores

### 4. Dashboard Display

**Components:**
- `app/dashboard/page.tsx` - Server component, renders layout
- `app/dashboard/DashboardScorecard.tsx` - Client component
  - Fetches latest scorecard on mount
  - Shows "Generate Scorecard" if none exists
  - Shows "Refresh" button if scorecard exists
- `components/scorecard/ScorecardView.tsx` - Renders the scorecard UI

**API:**
- `app/api/prime-scorecard/latest/route.ts`
  - Returns latest scorecard from eden_user_scorecards
  - Uses latest_scorecard_id from eden_user_state

---

## Database Tables

### `apple_health_imports`
- Tracks uploads
- Status: `uploaded` → `processing` → `completed` / `failed`
- Links to storage file via `file_path`

### `eden_metric_values`
- Stores individual metric measurements
- Links to import via `import_id` (FK with cascade delete)
- Links to metric definition via `metric_id`
- Unique constraint: `(import_id, metric_id, measured_at)`

### `eden_user_scorecards`
- Stores computed Prime Scorecards (JSON)
- One row per generation
- `scorecard_json` contains full PrimeScorecard object

### `eden_user_state`
- Tracks `latest_scorecard_id`
- Used to quickly fetch the most recent scorecard

---

## Key Connections

1. **Upload → Worker**: Worker polls `apple_health_imports` for `status='uploaded'`
2. **Worker → Metrics**: Worker writes to `eden_metric_values` with `import_id`
3. **Worker → Scorecard**: Worker calls Vercel endpoint to generate scorecard
4. **Metrics → Scorecard**: Scorecard computation reads from `eden_metric_values`
5. **Scorecard → Dashboard**: Dashboard reads from `eden_user_scorecards`

---

## Current Issue

**Problem**: Dashboard doesn't show numbers after processing completes.

**Possible causes**:
1. Scorecard not auto-generated (worker endpoint call failed)
2. Metrics written but not found (metric code mismatch)
3. Scorecard exists but is empty (no metrics matched)
4. Dashboard not refreshing (needs manual "Refresh" click)

**Debugging steps**:
1. Check `eden_metric_values` - are metrics there?
2. Check `eden_user_scorecards` - is there a scorecard?
3. Check worker logs - did scorecard generation succeed?
4. Check scorecard JSON - does it have evidence/metrics?

---

## Manual Scorecard Generation

If auto-generation fails, users can manually generate:
- Dashboard: Click "Generate Scorecard" or "Refresh" button
- Step 8: Auto-generates if no scorecard exists

This calls `POST /api/prime-scorecard/generate` which:
- Loads all current metrics
- Computes fresh scorecard
- Persists and updates latest_scorecard_id

