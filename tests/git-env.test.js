import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.js');

describe('git environment', () => {
  let root;
  let env;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-git-env-'));
    const configPath = path.join(root, 'gitconfig');
    fs.writeFileSync(configPath, '');
    env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: configPath,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' }).split('\n')) {
      if (name) delete env[name];
    }
    delete env.JEST_WORKER_ID;
    delete env.SKELETOR_CLI_TEST;
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('an inherited GIT_DIR does not redirect the initial commit', () => {
    const outer = path.join(root, 'outer');
    fs.mkdirSync(outer);
    git(outer, 'init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(outer, 'file.txt'), 'outer\n');
    git(outer, 'add', 'file.txt');
    git(outer, 'commit', '-q', '-m', 'outer');
    const outerGitDir = path.join(outer, '.git');
    const headBefore = git(outer, 'rev-parse', 'HEAD');
    const configBefore = fs.readFileSync(path.join(outerGitDir, 'config'), 'utf8');

    const work = path.join(root, 'work');
    fs.mkdirSync(work);
    execFileSync(process.execPath, [SRC, 'new', 'my-app', '--template', 'go', '--owner', 'my-org', '--auto'], {
      cwd: work,
      env: { ...env, GIT_DIR: outerGitDir },
      stdio: 'pipe',
    });

    expect(git(outer, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect(fs.readFileSync(path.join(outerGitDir, 'config'), 'utf8')).toBe(configBefore);

    const project = path.join(work, 'my-app');
    expect(fs.existsSync(path.join(project, '.git'))).toBe(true);
    expect(git(project, 'rev-parse', '--show-toplevel')).toBe(fs.realpathSync(project));
    expect(git(project, 'rev-list', '--count', 'HEAD')).toBe('1');
    expect(git(project, 'log', '-1', '--format=%s')).toBe('chore: initial commit from skeletor');
  });
});
