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
export {};
//# sourceMappingURL=index.d.ts.map