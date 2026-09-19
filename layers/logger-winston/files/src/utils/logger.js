const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { config } = require('@config');

const logDir = path.resolve(process.cwd(), '{{LOG_DIR}}');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const level = config.system.logLevel || (config.system.isProduction ? 'info' : 'debug');

const logger = winston.createLogger({
  level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: path.join(logDir, 'app.log') }),
  ],
});

module.exports = logger;
