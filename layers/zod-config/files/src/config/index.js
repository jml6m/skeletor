const { env } = require('./env.config.js');

const config = {
  system: {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    isDevelopment: env.NODE_ENV === 'development',
    server: {
      port: env.PORT,
    },
    logLevel: env.LOG_LEVEL,
  },
};

module.exports = { config };
