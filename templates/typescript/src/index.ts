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

console.log('👋 Hello from {{PROJECT_NAME}} (replace me)');

logger.info('Bootstrap complete');
