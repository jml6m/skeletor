process.env.SKELETOR_CLI_TEST = '1';

import {
  parseGithubOwnerFromUrl,
  detectGithubOwners,
  resolveOwner,
  collectSearchDirs,
} from '../src/detect-owner.js';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('detect-owner', () => {
  test('parseGithubOwnerFromUrl handles https and ssh remotes', () => {
    expect(parseGithubOwnerFromUrl('https://github.com/acme/my-app.git')).toBe('acme');
    expect(parseGithubOwnerFromUrl('git@github.com:acme/my-app.git')).toBe('acme');
  });

  test('resolveOwner uses CLI flag without detection', () => {
    const result = resolveOwner('explicit-owner', '/tmp');
    expect(result).toEqual({ owner: 'explicit-owner', detected: false });
  });

  test('detectGithubOwners finds owner from skeletor package.json', () => {
    const candidates = detectGithubOwners(ROOT);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => c.owner === 'jml6m')).toBe(true);
  });

  test('collectSearchDirs walks upward', () => {
    const child = path.join(ROOT, 'src');
    const dirs = collectSearchDirs(child);
    expect(dirs[0]).toBe(child);
    expect(dirs).toContain(ROOT);
  });
});