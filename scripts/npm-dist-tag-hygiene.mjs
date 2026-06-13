#!/usr/bin/env node
/**
 * Remove stale prerelease dist-tags after a stable publish.
 * Safe to run in CI (no-op on failure) or locally after npm publish.
 */

import { execSync } from 'child_process';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const { name, version } = pkg;

if (version.includes('-')) {
  console.log(`Prerelease ${version} — skipping dist-tag cleanup.`);
  process.exit(0);
}

const staleTags = ['alpha', 'next'];
for (const tag of staleTags) {
  try {
    const current = execSync(`npm dist-tag ls ${name}`, { encoding: 'utf8' }).trim();
    if (!current.split('\n').some((line) => line.startsWith(`${tag}:`))) {
      console.log(`✓ dist-tag "${tag}" not present — nothing to remove`);
      continue;
    }
    execSync(`npm dist-tag rm ${name} ${tag}`, { stdio: 'inherit' });
    console.log(`✓ Removed stale dist-tag "${tag}"`);
  } catch {
    console.log(`⚠ Could not remove dist-tag "${tag}" (may need publish rights or tag already gone)`);
  }
}