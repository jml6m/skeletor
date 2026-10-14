process.env.SKELETOR_CLI_TEST = '1';

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectGithubOwners } from '../src/detect-owner.js';
import { normalizeDescription } from '../src/escape.js';
import { buildRenderVars, render, runNew } from '../src/index.js';
import { suggestProjectName, validateGithubOwner, validateProjectName } from '../src/validate-input.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'index.js');
const NASTY = 'x "quoted" & <b>bold</b> \'it\' \\N $& {{YEAR}}\nsecond\tline';

function cliEnv(extra = {}) {
  /** @type {NodeJS.ProcessEnv} */
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
const unescapeXml = (value) => value.replace(/&(amp|lt|gt|quot|apos);/g, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);

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

  test.each(['-org', '--help', 'org-', 'my--org', 'my org', 'my/org', 'my-org;touch pwned', '$(id)', 'a'.repeat(40), ''])('rejects %j', (owner) => {
    expect(validateGithubOwner(owner)).not.toBeNull();
  });

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
    /** @type {Array<[string, string | undefined, string, (text: string) => string]>} */
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
  test.each([
    [[], 'public'],
    [['--private'], 'private'],
  ])('passes owner/name to gh as one argument, without a shell (%j)', (flags, visibility) => {
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
      const { status, output } = runCli(['new', 'my-app', '--template', 'go', '--owner', 'my-org', '--auto', '--github', ...flags], root, env);
      expect(status).toBe(0);
      expect(output).toContain(`GitHub repository created: my-org/my-app (${visibility})`);
      // The repository exists, so the one-time settings print in full, requiring the scaffold's CI job.
      expect(output).toContain('One-time GitHub settings for my-org/my-app.');
      expect(output).toContain('{ "context": "ci" }');
      const calls = fs
        .readFileSync(log, 'utf8')
        .split('---\n')
        .filter(Boolean)
        .map((c) => c.trimEnd().split('\n'));
      expect(calls).toContainEqual(['repo', 'create', 'my-org/my-app', `--${visibility}`, '--source=.', '--remote=origin']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  /** A temp dir with a stub `gh` (the script body) first on PATH, and git config isolated from the user's. */
  function ghStubEnv(root, ghScript, gitconfig, extra = {}) {
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\n${ghScript}\n`, { mode: 0o755 });
    const env = cliEnv({ PATH: `${bin}${path.delimiter}${process.env.PATH}`, GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', ...extra });
    for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL']) {
      if (!(key in extra)) delete env[key];
    }
    fs.writeFileSync(env.GIT_CONFIG_GLOBAL, gitconfig);
    return env;
  }

  test('a failed initial commit names the git step, skips --github and exits 1', () => {
    const root = tempDir('skeletor-gh-');
    // No user identity, and git may not guess one: the initial commit fails.
    const env = ghStubEnv(root, 'exit 0', '[user]\n\tuseConfigOnly = true\n');
    try {
      const { status, output } = runCli(['new', 'my-app', '--template', 'go', '--owner', 'my-org', '--auto', '--github'], root, env);
      expect(status).toBe(1);
      expect(output).toMatch(/git commit failed: [\s\S]*user/);
      expect(output).toContain('--github skipped');
      expect(output).toContain('the GitHub repository was not created');
      // The labels --github would have created are listed for creating by hand.
      expect(output).toContain('Layers expect these labels on GitHub: epic.');
      expect(output).not.toContain('One-time GitHub settings');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('a failed gh repo create exits 1 and prints the label commands', () => {
    const root = tempDir('skeletor-gh-');
    const env = ghStubEnv(root, '[ "$1" = repo ] && { echo "HTTP 403" >&2; exit 1; }\nexit 0', '', {
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    });
    try {
      const { status, output } = runCli(['new', 'my-app', '--template', 'go', '--owner', 'my-org', '--auto', '--github'], root, env);
      expect(status).toBe(1);
      expect(output).toContain('gh repo create failed: HTTP 403');
      expect(output).toContain('the GitHub repository was not created');
      expect(output).toContain('Layers expect these labels on GitHub: epic.');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('under --auto, a detected owner is printed with where it came from', () => {
    const root = tempDir('skeletor-owner-');
    const env = ghStubEnv(root, 'exit 1', '');
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ repository: 'https://github.com/pkg-owner/x' }));
      const { status, output } = runCli(['new', 'my-app', '--template', 'go', '--auto', '--no-git'], root, env);
      expect(status).toBe(0);
      expect(output).toContain(`Owner: pkg-owner (from package.json in ${fs.realpathSync(root)})`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('without --owner, an undetectable owner asks for --owner', () => {
    const root = tempDir('skeletor-owner-');
    const env = ghStubEnv(root, 'exit 1', '');
    try {
      const { status, output } = runCli(['new', 'my-app', '--template', 'go', '--auto', '--no-git'], root, env);
      expect(status).toBe(1);
      expect(output).toContain('The GitHub owner could not be detected: pass --owner <user>.');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
