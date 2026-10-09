process.env.SKELETOR_CLI_TEST = '1';

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRenderVars, render, runNew } from '../src/index.js';
import { escapeMarkdown, escapeTomlString, escapeXml, escaperForFile, normalizeDescription } from '../src/escape.js';
import { validateGithubOwner, validateProjectName } from '../src/validate-input.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'index.js');
const NASTY = 'x "quoted" & <b>bold</b> */ \\N $& {{YEAR}}\nsecond\tline';

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

function unescapeToml(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_m, c) => {
    if (c.length > 1) return String.fromCharCode(parseInt(c.slice(1), 16));
    return { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r' }[c] ?? c;
  });
}

function unescapeXml(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);
}

describe('validateProjectName', () => {
  test.each([
    ['../escape', null, 'single directory name'],
    ['@scope/name', null, 'single directory name'],
    ['a\\b', null, 'single directory name'],
    ['.hidden', null, 'single directory name'],
    ['..', null, 'single directory name'],
    ['-flag', null, 'single directory name'],
    ['my app', null, 'GitHub repository name'],
    ['app;touch pwned', null, 'GitHub repository name'],
    ['$(id)', null, 'GitHub repository name'],
    ['a'.repeat(101), null, 'GitHub repository name'],
    ['MyApp', 'javascript', 'npm package name: it must be lowercase'],
    ['_app', 'typescript', 'npm package name: it must not start with "_"'],
    ['http', 'javascript', 'Node.js core module name'],
    ['node_modules', 'javascript', 'is reserved'],
    ['app-', 'python', 'Python project name'],
    ['1app', 'rust', 'Cargo crate name: it must not start with a digit'],
    ['my.app', 'rust', 'Cargo crate name: use only letters'],
    ['fn', 'rust', 'Rust keyword'],
    ['test', 'rust', 'reserved by Cargo'],
    ['app.', 'go', 'Go module path element: it must not end with "."'],
    ['nul', 'go', 'reserved name on Windows'],
    ['1app', 'csharp', 'C# namespace: each dot-separated part must start with a letter'],
    ['my..app', 'csharp', 'C# namespace'],
    ['class', 'csharp', 'C# keyword'],
  ])('rejects %j (%s) naming the rule', (name, language, rule) => {
    expect(validateProjectName(name, language)).toContain(rule);
  });

  test.each([
    ['my-app', 'javascript'],
    ['my.app', 'typescript'],
    ['My_App', 'python'],
    ['my_app-2', 'rust'],
    ['My-App', 'go'],
    ['My.App', 'csharp'],
    ['1app', 'java'],
  ])('accepts %j for %s', (name, language) => {
    expect(validateProjectName(name, language)).toBeNull();
  });

  test('requires a name', () => {
    expect(validateProjectName('', null)).toContain('required');
    expect(validateProjectName(undefined, null)).toContain('required');
  });
});

describe('validateGithubOwner', () => {
  test.each(['my-org', 'a', 'A1-b2', 'a'.repeat(39)])('accepts %j', (owner) => {
    expect(validateGithubOwner(owner)).toBeNull();
  });

  test.each(['-org', 'org-', 'my--org', 'my org', 'my/org', 'my-org;touch pwned', '$(id)', '`id`', 'a'.repeat(40), ''])(
    'rejects %j',
    (owner) => {
      expect(validateGithubOwner(owner)).not.toBeNull();
    },
  );
});

test('owners that are not Java identifiers still give a valid Java package', () => {
  expect(buildRenderVars({ name: 'my-app', owner: '1org' }).JAVA_PACKAGE).toBe('io.github._1org');
  expect(buildRenderVars({ name: 'my-app', owner: 'int' }).JAVA_PACKAGE).toBe('io.github.int_');
  expect(buildRenderVars({ name: 'my-app', owner: 'my-org' }).JAVA_PACKAGE).toBe('io.github.myorg');
});

describe('description escaping', () => {
  test('render inserts values literally', () => {
    expect(render('{{DESCRIPTION}} {{YEAR}}', { DESCRIPTION: '$& {{YEAR}}', YEAR: 2026 })).toBe('$& {{YEAR}} 2026');
  });

  test('picks the escaper from the output file type', () => {
    expect(escaperForFile('a/package.json')('a "b"')).toBe('a \\"b\\"');
    expect(escaperForFile('Cargo.toml')).toBe(escapeTomlString);
    expect(escaperForFile('pom.xml')).toBe(escapeXml);
    expect(escaperForFile('Project.csproj')).toBe(escapeXml);
    expect(escaperForFile('README.md')).toBe(escapeMarkdown);
    expect(escaperForFile('Program.cs')).toBeNull();
  });

  test('TOML and XML escapes round-trip', () => {
    const value = 'a "b" \\ c\u0007 & <d> \'e\'';
    expect(unescapeToml(escapeTomlString(value))).toBe(value);
    expect(escapeTomlString(value)).not.toMatch(/[\u0000-\u001f]/);
    expect(unescapeXml(escapeXml(value))).toBe(value);
  });

  test('Markdown escape keeps HTML and line-start syntax literal', () => {
    expect(escapeMarkdown('<b>x</b> *y* [z]')).toBe('\\<b\\>x\\</b\\> \\*y\\* \\[z\\]');
    expect(escapeMarkdown('# not a heading')).toBe('\\# not a heading');
    expect(escapeMarkdown('1. not a list')).toBe('1\\. not a list');
    expect(escapeMarkdown('AT&T &amp;')).toBe('AT&T \\&amp;');
  });

  test('descriptions collapse to one line', () => {
    expect(normalizeDescription(' a\n\tb\u0000c ')).toBe('a b c');
  });

  test('generated manifests parse with a description full of special characters', async () => {
    const expected = normalizeDescription(NASTY);
    const cases = [
      { template: 'javascript' },
      { template: 'python', layout: 'src' },
      { template: 'rust', layout: 'workspace' },
      { template: 'java' },
      { template: 'csharp' },
    ];
    for (const { template, layout } of cases) {
      const name = `gen-desc-${template}-${Date.now()}`;
      const dir = path.resolve(process.cwd(), name);
      try {
        await runNew({ command: 'new', name, template, layout, owner: 'my-org', description: NASTY, auto: true, git: false, withLayers: [] });
        const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

        if (template === 'javascript') {
          expect(JSON.parse(read('package.json')).description).toBe(expected);
        }
        if (template === 'python' || template === 'rust') {
          const manifest = template === 'python' ? 'pyproject.toml' : path.join('crates', 'core', 'Cargo.toml');
          const line = read(manifest).split('\n').find((l) => l.startsWith('description = '));
          expect(line).toMatch(/^description = "(?:[^"\\]|\\.)*"$/);
          expect(unescapeToml(line.slice('description = "'.length, -1))).toBe(expected);
        }
        if (template === 'python') {
          expect(read(path.join('src', 'app', '__init__.py'))).toContain('x \\"quoted\\" & <b>bold</b> */ \\\\N');
        }
        if (template === 'java') {
          const description = read('pom.xml').match(/<description>([^<]*)<\/description>/);
          expect(description).not.toBeNull();
          expect(unescapeXml(description[1])).toBe(expected);
          const app = read(path.join('src', 'main', 'java', 'io', 'github', 'myorg', 'App.java'));
          expect(app.split('*/').length).toBe(2);
          expect(app).not.toContain('\\N');
        }
        if (template === 'csharp') {
          expect(read('Program.cs')).toContain(`// ${expected}\n`);
        }
        expect(read('README.md')).toContain('x "quoted" & \\<b\\>bold\\</b\\> \\*/ \\\\N $& {{YEAR}} second line');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

describe('CLI rejects unsafe input before writing anything', () => {
  test.each([
    [['../escape', '--template', 'go'], 'single directory name'],
    [['@scope/name', '--template', 'javascript'], 'single directory name'],
    [['MyApp', '--template', 'javascript'], 'npm package name'],
    [['my app', '--template', 'javascript'], 'GitHub repository name'],
    [['1app', '--template', 'csharp'], 'C# namespace'],
    [['app;touch pwned', '--template', 'go'], 'GitHub repository name'],
    [['ok-app', '--template', 'go', '--owner', 'my-org;touch pwned'], 'GitHub owner'],
    [['ok-app', '--template', 'go', '--owner', '$(touch pwned)'], 'GitHub owner'],
  ])('new %j', (args, rule) => {
    const root = tempDir('skeletor-unsafe-');
    const cwd = path.join(root, 'work');
    fs.mkdirSync(cwd);
    try {
      const owner = args.includes('--owner') ? [] : ['--owner', 'my-org'];
      const { status, output } = runCli(['new', ...args, ...owner, '--auto', '--no-git'], cwd);
      expect(status).not.toBe(0);
      expect(output).toContain(rule);
      expect(fs.readdirSync(cwd)).toEqual([]);
      expect(fs.readdirSync(root)).toEqual(['work']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
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
