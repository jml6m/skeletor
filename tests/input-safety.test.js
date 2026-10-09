process.env.SKELETOR_CLI_TEST = '1';

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRenderVars, render, runNew } from '../src/index.js';
import { detectGithubOwners } from '../src/detect-owner.js';
import { normalizeDescription } from '../src/escape.js';
import { suggestProjectName, validateGithubOwner, validateProjectName } from '../src/validate-input.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'index.js');
const NASTY = 'x "quoted" & <b>bold</b> \'it\' \\N $& {{YEAR}}\nsecond\tline';

function cliEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.JEST_WORKER_ID;
  delete env.SKELETOR_CLI_TEST;
  return env;
}

/** Runs the CLI without a shell; resolves to { status, output }. */
function runCli(args, cwd, env = cliEnv()) {
  try {
    const output = execFileSync(process.execPath, [SRC, ...args], { cwd, env, stdio: 'pipe' }).toString();
    return { status: 0, output };
  } catch (e) {
    return { status: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const unescapeQuoted = (value) => value.replace(/\\(.)/g, '$1');
const unescapeXml = (value) =>
  value.replace(/&(amp|lt|gt|quot|apos);/g, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);

describe('project name rule', () => {
  test.each(['my-app', 'a', 'app2', 'my-2nd-app', 'a'.repeat(64)])('accepts %j', (name) => {
    expect(validateProjectName(name)).toBeNull();
  });

  test.each([
    ['MyApp', 'myapp'],
    ['My App', 'my-app'],
    ['my_app', 'my-app'],
    ['my.app', 'my-app'],
    ['1app', 'app-1app'],
    ['-app-', 'app'],
    ['my--app', 'my-app'],
    ['../escape', 'escape'],
    ['@scope/name', 'scope-name'],
    ['a\\b', 'a-b'],
    ['app;touch pwned', 'app-touch-pwned'],
    ['a'.repeat(65), 'a'.repeat(64)],
    ['', 'my-app'],
  ])('rejects %j and suggests %j', (name, suggestion) => {
    const error = validateProjectName(name);
    expect(error).toContain('Project names are lowercase kebab-case, starting with a letter (e.g. my-app)');
    expect(error).toContain(`"${suggestion}"`);
    expect(suggestProjectName(name)).toBe(suggestion);
    expect(validateProjectName(suggestion)).toBeNull();
  });
});

describe('CLI rejects invalid names before writing anything', () => {
  test.each([['../escape'], ['@scope/x'], ['MyApp']])('new %j', (name) => {
    const root = tempDir('skeletor-name-');
    const cwd = path.join(root, 'work');
    fs.mkdirSync(cwd);
    try {
      const { status, output } = runCli(['new', name, '--template', 'go', '--owner', 'my-org', '--auto', '--no-git'], cwd);
      expect(status).toBe(1);
      expect(output).toContain('lowercase kebab-case');
      expect(output).toContain(`Try "${suggestProjectName(name)}"`);
      expect(fs.readdirSync(cwd)).toEqual([]);
      expect(fs.readdirSync(root)).toEqual(['work']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('GitHub owner rule', () => {
  test.each(['my-org', 'a', 'A1-b2', 'a'.repeat(39)])('accepts %j', (owner) => {
    expect(validateGithubOwner(owner)).toBeNull();
  });

  test.each(['-org', '--help', 'org-', 'my--org', 'my org', 'my/org', 'my-org;touch pwned', '$(id)', 'a'.repeat(40), ''])(
    'rejects %j',
    (owner) => {
      expect(validateGithubOwner(owner)).not.toBeNull();
    },
  );

  test('--owner with shell metacharacters exits 1', () => {
    const cwd = tempDir('skeletor-owner-');
    try {
      const { status, output } = runCli(['new', 'my-app', '--template', 'go', '--owner', 'my-org;touch pwned', '--auto', '--no-git'], cwd);
      expect(status).toBe(1);
      expect(output).toContain('not a valid GitHub user or organization name');
      expect(fs.readdirSync(cwd)).toEqual([]);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('a detected owner starting with "-" is dropped', () => {
    const dir = tempDir('skeletor-detect-');
    try {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ repository: 'https://github.com/-evil/x' }));
      expect(detectGithubOwners(dir).map((c) => c.owner)).not.toContain('-evil');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('owners that are not Java identifiers still give a valid Java package', () => {
    expect(buildRenderVars({ name: 'my-app', owner: '1org' }).JAVA_PACKAGE).toBe('io.github._1org');
    expect(buildRenderVars({ name: 'my-app', owner: 'int' }).JAVA_PACKAGE).toBe('io.github.int_');
    expect(buildRenderVars({ name: 'my-app', owner: 'my-org' }).JAVA_PACKAGE).toBe('io.github.myorg');
  });
});

test('the C# namespace is the name in PascalCase', () => {
  expect(buildRenderVars({ name: 'my-app', owner: 'o' }).CSHARP_NAMESPACE).toBe('MyApp');
  expect(buildRenderVars({ name: 'app-2-go', owner: 'o' }).CSHARP_NAMESPACE).toBe('App2Go');
});

describe('description', () => {
  test('render inserts values literally', () => {
    expect(render('{{DESCRIPTION}} {{YEAR}}', { DESCRIPTION: '$& {{YEAR}}', YEAR: 2026 })).toBe('$& {{YEAR}} 2026');
  });

  test('collapses to one line', () => {
    expect(normalizeDescription(' a\n\tb\u0000c\u007f ')).toBe('a b c');
  });

  test('round-trips through package.json, pyproject.toml, Cargo.toml and pom.xml', async () => {
    const expected = normalizeDescription(NASTY);
    const tomlValue = (text) => {
      const line = text.split('\n').find((l) => l.startsWith('description = '));
      expect(line).toMatch(/^description = "(?:[^"\\]|\\.)*"$/);
      return unescapeQuoted(line.slice('description = "'.length, -1));
    };
    const cases = [
      ['javascript', undefined, 'package.json', (t) => JSON.parse(t).description],
      ['python', 'src', 'pyproject.toml', tomlValue],
      ['rust', 'single', 'Cargo.toml', tomlValue],
      ['java', undefined, 'pom.xml', (t) => unescapeXml(t.match(/<description>([^<]*)<\/description>/)[1])],
    ];
    for (const [template, layout, file, read] of cases) {
      const name = `gen-desc-${template}-${Date.now()}`;
      const dir = path.resolve(process.cwd(), name);
      try {
        await runNew({ command: 'new', name, template, layout, owner: 'my-org', description: NASTY, auto: true, git: false, withLayers: [] });
        expect(read(fs.readFileSync(path.join(dir, file), 'utf8'))).toBe(expected);
        expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain(expected);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

const describePosix = process.platform === 'win32' ? describe.skip : describe;

describePosix('--github', () => {
  test('passes owner/name to gh as one argument, without a shell', () => {
    const root = tempDir('skeletor-gh-');
    const bin = path.join(root, 'bin');
    const log = path.join(root, 'gh.log');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$@" >> "$GH_LOG"\nprintf -- "---\\n" >> "$GH_LOG"\n', { mode: 0o755 });
    const env = cliEnv({
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      GH_LOG: log,
      GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    });
    fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '');
    try {
      const { status } = runCli(['new', 'my-app', '--template', 'go', '--owner', 'my-org', '--auto', '--github'], root, env);
      expect(status).toBe(0);
      const calls = fs.readFileSync(log, 'utf8').split('---\n').filter(Boolean).map((c) => c.trimEnd().split('\n'));
      expect(calls).toContainEqual(['repo', 'create', 'my-org/my-app', '--public', '--source=.', '--remote=origin']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
