#!/usr/bin/env node
/**
 * {{PROJECT_NAME}} entry point
 *
 * Replace this with your application bootstrap.
 * Follow the layered architecture and alias rules from AGENTS.md.
 */

// MUST be first for @alias support at runtime (module-alias + _moduleAliases in package.json)
require('module-alias/register');

const logger = require('@utils/logger');

// Demonstrate alias + structured logging (no console.log in prod paths)
logger.info('Application starting', { nodeVersion: process.version });

console.log('👋 Hello from {{PROJECT_NAME}} (replace me)');

logger.info('Bootstrap complete');
