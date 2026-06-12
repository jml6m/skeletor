#!/usr/bin/env node
// Clean reinstall: blow away node_modules + the lockfile, reinstall from scratch,
// then run the critical/high audit gate. Use this instead of hand-deleting
// node_modules so the audit step always runs after a dependency refresh.
import { rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// shell:true on Windows so the npm.cmd shim spawns (Node blocks bare .cmd).
const run = (args) => execFileSync('npm', args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });

console.log('🗑️  Removing node_modules and package-lock.json...');
for (const target of ['node_modules', 'package-lock.json']) {
  const full = join(root, target);
  if (existsSync(full)) rmSync(full, { recursive: true, force: true });
}

console.log('📦 Installing fresh dependencies...');
run(['install']);

console.log('🔒 Running audit gate (critical/high)...');
run(['run', 'audit:ci']);
