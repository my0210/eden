/**
 * Configuration for the Apple Health worker
 * All values come from environment variables
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

export const config = {
  // Supabase connection
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // Worker settings
  pollIntervalMs: parseInt(optionalEnv('POLL_INTERVAL_MS', '5000'), 10),
  workerConcurrency: parseInt(optionalEnv('WORKER_CONCURRENCY', '1'), 10),

  // Logging
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
}

export type Config = typeof config

