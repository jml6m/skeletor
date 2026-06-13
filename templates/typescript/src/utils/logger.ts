import { config } from '#config/env.config.js';

/**
 * Structured logger stub.
 *
 * In real projects, replace with Winston (or your preferred logger)
 * and import from here everywhere.
 *
 * Rules (from conventions):
 * - Messages are static strings
 * - Dynamic data goes in the metadata object (2nd arg)
 * - For errors: { error: err.message, stack: err.stack }
 */

type LogMeta = Record<string, unknown> | undefined;

function formatMeta(meta?: LogMeta): string {
  if (!meta || typeof meta !== 'object') return '';
  try {
    return ' ' + JSON.stringify(meta);
  } catch {
    return '';
  }
}

const logger = {
  info(msg: string, meta?: LogMeta) {
    console.info(`[INFO] ${msg}${formatMeta(meta)}`);
  },
  warn(msg: string, meta?: LogMeta) {
    console.warn(`[WARN] ${msg}${formatMeta(meta)}`);
  },
  error(msg: string, meta?: LogMeta) {
    console.error(`[ERROR] ${msg}${formatMeta(meta)}`);
  },
  debug(msg: string, meta?: LogMeta) {
    if (!config.system.isProduction) {
      console.debug(`[DEBUG] ${msg}${formatMeta(meta)}`);
    }
  },
  http(msg: string, meta?: LogMeta) {
    console.info(`[HTTP] ${msg}${formatMeta(meta)}`);
  },
};

export default logger;