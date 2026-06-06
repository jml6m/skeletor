/**
 * Application error / status constants.
 * Expand as the domain grows.
 */

const ERRORS = {
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Resource not found' },
  INVALID_INPUT: { status: 400, code: 'INVALID_INPUT', message: 'Invalid input' },
};

module.exports = { ERRORS };
