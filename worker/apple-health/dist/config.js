"use strict";
/**
 * Configuration for the Apple Health worker
 * All values come from environment variables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function optionalEnv(name, defaultValue) {
    return process.env[name] || defaultValue;
}
exports.config = {
    // Supabase connection
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    // Worker settings
    pollIntervalMs: parseInt(optionalEnv('POLL_INTERVAL_MS', '5000'), 10),
    workerConcurrency: parseInt(optionalEnv('WORKER_CONCURRENCY', '1'), 10),
    // Logging
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
};
//# sourceMappingURL=config.js.map