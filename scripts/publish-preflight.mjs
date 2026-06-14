#!/usr/bin/env node
/**
 * Preflight checks before tagging or publishing @jml6m/skeletor.
 * Used locally and in .github/workflows/publish.yml.
 */

import { execSync } from 'child_process';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const { name, version } = pkg;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

const ref = process.env.GITHUB_REF || '';
if (ref.startsWith('refs/tags/')) {
  const tag = ref.slice('refs/tags/'.length);
  const expected = tag.startsWith('v') ? tag.slice(1) : tag;
  if (expected !== version) {
    fail(`Git tag "${tag}" does not match package.json version "${version}".`);
  }
  pass(`Tag ${tag} matches package.json version ${version}`);
}

if (process.env.SKELETOR_SKIP_NPM_PUBLISHED_CHECK !== '1') {
  try {
    const published = execSync(`npm view ${name}@${version} version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (published === version) {
      fail(`${name}@${version} is already on npm. Bump version before publishing.`);
    }
  } catch {
    pass(`${name}@${version} is not published yet`);
  }
} else {
  pass(`Skipped npm published check (SKELETOR_SKIP_NPM_PUBLISHED_CHECK)`);
}

pass(`Preflight OK for ${name}@${version}`);