/**
 * Eden Apple Health Worker
 * 
 * Main entry point for the Railway worker that processes Apple Health exports.
 * 
 * Flow:
 * 1. Poll apple_health_imports for status='uploaded'
 * 2. Atomically claim one row (optimistic locking)
 * 3. Process the import (download ZIP, parse XML, extract metrics)
 * 4. Update status to 'completed' or 'failed'
 * 5. Repeat
 */

import { config } from './config'
import { claimNextImport } from './claimNextImport'
import { processImport } from './processImportStub'
import { log } from './logger'

// Track if we should keep running
let isRunning = true

// Track active processing count
let activeCount = 0

/**
 * Process one iteration of the worker loop
 * Returns true if work was done, false if idle
 */
async function processOnce(): Promise<boolean> {
  // Check concurrency limit
  if (activeCount >= config.workerConcurrency) {
    return false
  }

  // Try to claim an import
  const importRow = await claimNextImport()
  
  if (!importRow) {
    return false // No work available
  }

  // Process the import (don't await - allow concurrency)
  activeCount++
  
  processImport(importRow)
    .catch(err => {
      log.error(`Unhandled error in processImport`, {
        import_id: importRow.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })
    .finally(() => {
      activeCount--
    })

  return true
}

/**
 * Main worker loop
 */
async function runWorker(): Promise<void> {
  log.info('Worker starting', {
    poll_interval_ms: config.pollIntervalMs,
    concurrency: config.workerConcurrency,
    supabase_url: config.supabaseUrl,
  })

  let lastLoggedIdle = 0
  const IDLE_LOG_INTERVAL_MS = 60000 // Log idle status every 60 seconds

  while (isRunning) {
    try {
      const didWork = await processOnce()

      if (!didWork) {
        // Log idle status periodically
        const now = Date.now()
        if (now - lastLoggedIdle > IDLE_LOG_INTERVAL_MS) {
          log.debug('Worker idle, waiting for imports', {
            active_count: activeCount,
          })
          lastLoggedIdle = now
        }
      }
    } catch (err) {
      log.error('Error in worker loop', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs))
  }

  // Wait for active jobs to finish
  while (activeCount > 0) {
    log.info(`Waiting for ${activeCount} active jobs to finish...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  log.info('Worker stopped')
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    log.info(`Received ${signal}, shutting down gracefully...`)
    isRunning = false
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Validate config on startup (will throw if missing required env vars)
    log.info('Eden Apple Health Worker', {
      version: '1.0.0',
      node_version: process.version,
      env: process.env.NODE_ENV || 'development',
    })

    setupGracefulShutdown()
    await runWorker()
    process.exit(0)

  } catch (err) {
    log.error('Fatal error', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    process.exit(1)
  }
}

// Run
main()

