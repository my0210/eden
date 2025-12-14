"use strict";
/**
 * Simple structured logger for the worker
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
function getLogLevel() {
    const level = process.env.LOG_LEVEL?.toLowerCase();
    return level && LOG_LEVELS[level] !== undefined ? level : 'info';
}
function shouldLog(level) {
    const currentLevel = getLogLevel();
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (data && Object.keys(data).length > 0) {
        return `${base} ${JSON.stringify(data)}`;
    }
    return base;
}
exports.log = {
    debug(message, data) {
        if (shouldLog('debug')) {
            console.log(formatMessage('debug', message, data));
        }
    },
    info(message, data) {
        if (shouldLog('info')) {
            console.log(formatMessage('info', message, data));
        }
    },
    warn(message, data) {
        if (shouldLog('warn')) {
            console.warn(formatMessage('warn', message, data));
        }
    },
    error(message, data) {
        if (shouldLog('error')) {
            const errorData = typeof data === 'string' ? { error: data } : data;
            console.error(formatMessage('error', message, errorData));
        }
    },
};
//# sourceMappingURL=logger.js.map