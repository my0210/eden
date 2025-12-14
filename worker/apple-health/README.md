# Eden Apple Health Worker

A Railway worker service that processes Apple Health exports uploaded to Eden.

## Overview

This worker continuously polls the `apple_health_imports` table for new uploads and processes them:

1. **Polls** for imports with `status='uploaded'`
2. **Claims** one import atomically (prevents duplicate processing)
3. **Processes** the import (downloads ZIP, parses XML, extracts metrics)
4. **Updates** status to `completed` or `failed`

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Eden App      │     │   Supabase      │     │   Railway       │
│   (Vercel)      │────▶│   Database      │◀────│   Worker        │
│                 │     │   Storage       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                       │                       │
       │ 1. Upload ZIP         │                       │
       │───────────────────────▶                       │
       │                       │                       │
       │                       │ 2. Poll for uploads   │
       │                       │◀──────────────────────│
       │                       │                       │
       │                       │ 3. Claim & process    │
       │                       │◀──────────────────────│
       │                       │                       │
       │                       │ 4. Insert metrics     │
       │                       │◀──────────────────────│
       │                       │                       │
```

## Files

```
worker/apple-health/
├── src/
│   ├── index.ts           # Main entry point and worker loop
│   ├── config.ts          # Environment configuration
│   ├── supabase.ts        # Supabase client (service role)
│   ├── claimNextImport.ts # Atomic claim logic
│   ├── processImportStub.ts # Processing (stub in PR7A)
│   └── logger.ts          # Structured logging
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | - | Service role key (admin access) |
| `POLL_INTERVAL_MS` | No | `5000` | How often to poll for new imports |
| `WORKER_CONCURRENCY` | No | `1` | Max concurrent imports to process |
| `LOG_LEVEL` | No | `info` | Logging level (debug/info/warn/error) |

## Railway Deployment

### 1. Create Railway Service

1. Go to [Railway](https://railway.app)
2. Create a new project or use existing
3. Click **"New Service"** → **"Deploy from GitHub repo"**
4. Select your Eden repository

### 2. Configure Service

In Railway service settings:

1. **Root Directory**: Set to `worker/apple-health`
2. **Build Command**: (auto-detected from Dockerfile)
3. **Start Command**: (auto-detected from Dockerfile)

### 3. Set Environment Variables

In Railway → Service → Variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
POLL_INTERVAL_MS=5000
WORKER_CONCURRENCY=1
LOG_LEVEL=info
```

> ⚠️ **Important**: Use the **Service Role Key** from Supabase Dashboard → Settings → API, not the anon key.

### 4. Deploy

Railway will automatically:
1. Build the Docker image
2. Start the worker
3. Keep it running

### 5. Monitor

Check Railway logs to see:
- Worker startup
- Import claims
- Processing results
- Any errors

## Local Development

```bash
# Install dependencies
cd worker/apple-health
npm install

# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Run in development mode
npm run dev

# Or build and run
npm run build
npm start
```

## Testing

1. Upload an Apple Health export ZIP in the Eden app
2. Watch Railway logs - you should see:
   ```
   [INFO] Claimed import {"import_id":"...", "status":"processing"}
   [INFO] Import completed {"import_id":"...", "status":"completed"}
   ```
3. Check `apple_health_imports` table - status should be `completed`

## Status Transitions

```
uploaded → processing → completed
                    └─→ failed
```

- `uploaded`: File uploaded to storage, waiting for processing
- `processing`: Worker has claimed and is processing
- `completed`: Successfully processed, metrics extracted
- `failed`: Processing failed, see `error_message` column

## Logs

The worker logs structured JSON for easy parsing:

```json
{"timestamp":"2024-01-15T10:30:00Z","level":"INFO","message":"Claimed import","import_id":"abc123","user_id":"xyz789"}
```

## Troubleshooting

### Worker not claiming imports

1. Check `apple_health_imports` table has rows with `status='uploaded'`
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct (not anon key)
3. Check Railway logs for errors

### Import stuck in "processing"

1. Worker may have crashed - check Railway logs
2. Manually reset: `UPDATE apple_health_imports SET status='uploaded', processing_started_at=NULL WHERE id='...'`

### Permission errors

1. Ensure using Service Role Key (has full access)
2. Check RLS policies aren't blocking service role

## PR7B: Real Processing

The current implementation is a stub (PR7A). PR7B will add:
- Download ZIP from Supabase storage
- Stream unzip (memory efficient)
- Parse export.xml
- Extract metrics using `lib/prime-scorecard/mapping.ts`
- Insert into `eden_metric_values`

