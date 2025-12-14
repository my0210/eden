/**
 * Simple structured logger for the worker
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
  return level && LOG_LEVELS[level] !== undefined ? level : 'info'
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatMessage(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`
  
  if (data && Object.keys(data).length > 0) {
    return `${base} ${JSON.stringify(data)}`
  }
  
  return base
}

export const log = {
  debug(message: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, data))
    }
  },

  info(message: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, data))
    }
  },

  warn(message: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, data))
    }
  },

  error(message: string, data?: Record<string, unknown> | string) {
    if (shouldLog('error')) {
      const errorData = typeof data === 'string' ? { error: data } : data
      console.error(formatMessage('error', message, errorData))
    }
  },
}

