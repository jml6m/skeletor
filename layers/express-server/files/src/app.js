const express = require('express');

/** Builds the Express app without listening, so tests can start it on a free port. */
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

module.exports = { createApp };
