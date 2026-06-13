import { env } from './env.config.js';

export const config = {
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