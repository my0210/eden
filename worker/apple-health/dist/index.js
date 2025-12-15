"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const claimNextImport_1 = require("./claimNextImport");
const processImport_1 = require("./processImport");
const logger_1 = require("./logger");
const supabase_1 = require("./supabase");
// Track if we should keep running
let isRunning = true;
// Track active processing count
let activeCount = 0;
/**
 * Process one iteration of the worker loop
 * Returns true if work was done, false if idle
 */
async function processOnce() {
    // Check concurrency limit
    if (activeCount >= config_1.config.workerConcurrency) {
        return false;
    }
    // Try to claim an import
    const importRow = await (0, claimNextImport_1.claimNextImport)();
    if (!importRow) {
        return false; // No work available
    }
    // Process the import (don't await - allow concurrency)
    activeCount++;
    (0, processImport_1.processImport)(importRow)
        .catch(err => {
        logger_1.log.error(`Unhandled error in processImport`, {
            import_id: importRow.id,
            error: err instanceof Error ? err.message : String(err),
        });
    })
        .finally(() => {
        activeCount--;
    });
    return true;
}
/**
 * Extract hostname from URL
 */
function getHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'invalid-url';
    }
}
/**
 * Test Supabase connection with a trivial query
 */
async function testSupabaseConnection() {
    const supabase = (0, supabase_1.getSupabase)();
    const { error } = await supabase.from('apple_health_imports').select('id').limit(1);
    if (error) {
        throw new Error(`Supabase connection test failed: ${error.message}`);
    }
    logger_1.log.info('Connected to Supabase');
}
/**
 * Main worker loop
 */
async function runWorker() {
    const supabaseHost = getHostname(config_1.config.supabaseUrl);
    logger_1.log.info('Worker starting', {
        poll_interval_ms: config_1.config.pollIntervalMs,
        concurrency: config_1.config.workerConcurrency,
        supabase_host: supabaseHost,
        eden_app_url_configured: !!config_1.config.edenAppUrl,
        worker_secret_configured: !!config_1.config.workerSecret,
    });
    // Test connection before starting
    await testSupabaseConnection();
    let lastLoggedIdle = 0;
    const IDLE_LOG_INTERVAL_MS = 60000; // Log idle status every 60 seconds
    while (isRunning) {
        try {
            const didWork = await processOnce();
            if (!didWork) {
                // Log idle status periodically
                const now = Date.now();
                if (now - lastLoggedIdle > IDLE_LOG_INTERVAL_MS) {
                    logger_1.log.debug('Worker idle, waiting for imports', {
                        active_count: activeCount,
                    });
                    lastLoggedIdle = now;
                }
            }
        }
        catch (err) {
            logger_1.log.error('Error in worker loop', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, config_1.config.pollIntervalMs));
    }
    // Wait for active jobs to finish
    while (activeCount > 0) {
        logger_1.log.info(`Waiting for ${activeCount} active jobs to finish...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    logger_1.log.info('Worker stopped');
}
/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
    const shutdown = (signal) => {
        logger_1.log.info(`Received ${signal}, shutting down gracefully...`);
        isRunning = false;
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
/**
 * Main entry point
 */
async function main() {
    try {
        // Validate config on startup (will throw if missing required env vars)
        logger_1.log.info('Eden Apple Health Worker', {
            version: '1.0.0',
            node_version: process.version,
            env: process.env.NODE_ENV || 'development',
        });
        setupGracefulShutdown();
        await runWorker();
        process.exit(0);
    }
    catch (err) {
        logger_1.log.error('Fatal error', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
        process.exit(1);
    }
}
// Run
main();
//# sourceMappingURL=index.js.map