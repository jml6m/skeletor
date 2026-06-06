/**
 * Centralized environment / config.
 *
 * Never read process.env directly in feature code — go through here.
 * Use Zod in real projects for validation + defaults (see reference projects).
 */

const raw = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
};

const config = {
  system: {
    env: raw.env,
    isProduction: raw.env === 'production',
    isTest: raw.env === 'test',
    isDevelopment: raw.env === 'development',
    server: {
      port: Number(raw.port),
    },
  },
};

module.exports = { config };
