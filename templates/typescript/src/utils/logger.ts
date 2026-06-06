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

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  try {
    return ' ' + JSON.stringify(meta);
  } catch {
    return '';
  }
}

const logger = {
  info(msg, meta) {
    console.info(`[INFO] ${msg}${formatMeta(meta)}`);
  },
  warn(msg, meta) {
    console.warn(`[WARN] ${msg}${formatMeta(meta)}`);
  },
  error(msg, meta) {
    console.error(`[ERROR] ${msg}${formatMeta(meta)}`);
  },
  debug(msg, meta) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${msg}${formatMeta(meta)}`);
    }
  },
  http(msg, meta) {
    console.log(`[HTTP] ${msg}${formatMeta(meta)}`);
  },
};

export default logger;
