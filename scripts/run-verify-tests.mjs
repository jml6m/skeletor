#!/usr/bin/env node
/**
 * Run template verifyCommands integration tests (requires language toolchains).
 * Used by CI verify-templates job and optionally locally.
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