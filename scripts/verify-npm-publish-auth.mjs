#!/usr/bin/env node
/**
 * Verify npm Trusted Publishing auth via dry-run before a real publish.
 * Prints actionable setup steps when OIDC is not linked on npmjs.com.
 */

import { execSync } from 'child_process';

const SETUP = `
npm publish auth failed (usually E404).

Configure Trusted Publishing on npm BEFORE pushing release tags:

  1. Open https://www.npmjs.com/package/@jml6m/skeletor/settings
  2. Trusted publishing → GitHub Actions
  3. Set exactly:
       Organization or user: jml6m
       Repository:           skeletor
       Workflow filename:    publish.yml
       Environment name:     npm
       Allowed actions:      npm publish
  4. Save, then re-run the Publish workflow (Actions → Publish to npm → Re-run)

Until Trusted Publishing is configured, publish locally instead:
  npm publish --tag latest --access public --otp=<code>

See docs/RELEASE.md for the full checklist.
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