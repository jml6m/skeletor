#!/usr/bin/env node
/**
 * Verify npm Trusted Publishing auth via dry-run before a real publish.
 * Prints actionable setup steps when OIDC is not linked on npmjs.com.
 */

import { execSync } from 'child_process';

const SETUP = `
npm publish auth failed (usually E404).

Check the package's trusted-publishing settings on npmjs.com against the publish workflow,
then re-run it. Until then, publish locally: npm publish --tag latest --access public --otp=<code>
`.trim();

function runDryRun() {
  execSync('npm publish --dry-run --provenance --access public', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}

try {
  runDryRun();
  console.log('✓ npm publish dry-run succeeded — Trusted Publishing auth looks good.');
} catch {
  console.error(`\n${SETUP}\n`);
  process.exit(1);
}