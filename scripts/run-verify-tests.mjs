#!/usr/bin/env node
/**
 * Run template verifyCommands integration tests (requires language toolchains).
 * Used by the CI verify jobs and optionally locally. SKELETOR_VERIFY_SHARD=<shard> runs one shard
 * (see scripts/verify-shards.mjs); unset runs every case.
 */

import { spawnSync } from 'child_process';

const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    './node_modules/jest/bin/jest.js',
    'tests/generate.test.js',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, SKELETOR_VERIFY_COMMANDS: '1' },
  },
);

process.exit(result.status ?? 1);