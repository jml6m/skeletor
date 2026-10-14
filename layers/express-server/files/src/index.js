#!/usr/bin/env node
// MUST be first for @alias support at runtime (module-alias + _moduleAliases in package.json)
require('module-alias/register');

const { config } = require('@config');
const logger = require('@utils/logger');
const { createApp } = require('./app');

const { port } = config.system.server;

createApp().listen(port, (error) => {
  if (error) {
    logger.error('Server failed to start', {
      port,
      error: error.message,
      stack: error.stack,
    });
    process.exitCode = 1;
    return;
  }
  logger.info('Server listening', { port });
});
