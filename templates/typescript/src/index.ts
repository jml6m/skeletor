#!/usr/bin/env node
/**
 * {{PROJECT_NAME}} entry point
 *
 * Replace this with your application bootstrap.
 * Follow the layered architecture and alias rules from AGENTS.md.
 */

import logger from '#utils/logger.js';

// Demonstrate alias + structured logging (no console.log in prod paths)
logger.info('Application starting', { nodeVersion: process.version });

logger.info('Hello (replace me)', {
  app: '{{PROJECT_NAME}}',
});

logger.info('Bootstrap complete');
