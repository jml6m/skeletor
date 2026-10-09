import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.js');

/** Scaffolds my-app with git enabled, using only `globalConfig` as the user's git config. */
function scaffoldBranch(globalConfig) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-branch-'));
  const configPath = path.join(root, 'gitconfig');
  fs.writeFileSync(configPath, globalConfig);
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: configPath,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  delete env.JEST_WORKER_ID;
  delete env.SKELETOR_CLI_TEST;
  try {
    execFileSync(process.execPath, [SRC, 'new', 'my-app', '--template', 'go', '--owner', 'my-org', '--auto'], { cwd: root, env, stdio: 'pipe' });
    const cwd = path.join(root, 'my-app');
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd, env, encoding: 'utf8' }).trim();
    const commits = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd, env, encoding: 'utf8' }).trim();
    return { branch, commits };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('initial branch', () => {
  test('is main when init.defaultBranch is unset', () => {
    expect(scaffoldBranch('')).toEqual({ branch: 'main', commits: '1' });
  });

  test("is main even when the user's init.defaultBranch says otherwise", () => {
    expect(scaffoldBranch('[init]\n\tdefaultBranch = trunk\n')).toEqual({ branch: 'main', commits: '1' });
  });
});
