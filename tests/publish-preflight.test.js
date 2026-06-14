import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'publish-preflight.mjs');

function runPreflight(env = {}) {
  return execSync(`node "${SCRIPT}"`, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('publish-preflight', () => {
  test('passes when tag matches package.json version', () => {
    const out = runPreflight({
      GITHUB_REF: 'refs/tags/v0.2.2',
      SKELETOR_SKIP_NPM_PUBLISHED_CHECK: '1',
    });
    expect(out).toContain('Preflight OK');
    expect(out).toContain('@jml6m/skeletor@0.2.2');
  });

  test('fails when tag does not match package.json version', () => {
    expect(() => runPreflight({ GITHUB_REF: 'refs/tags/v9.9.9' })).toThrow();
  });
});