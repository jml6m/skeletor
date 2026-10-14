#!/usr/bin/env node
/**
 * {{PROJECT_NAME}} entry point
 *
 * Replace this with your application bootstrap.
 * AGENTS.md has the import and logging conventions.
 */

import logger from '#utils/logger.js';

// Demonstrate alias + structured logging (no console.log in prod paths)
logger.info('Application starting', { nodeVersion: process.version });

logger.info('Hello (replace me)', {
  app: '{{PROJECT_NAME}}',
});

logger.info('Bootstrap complete');
