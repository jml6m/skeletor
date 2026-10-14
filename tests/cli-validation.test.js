process.env.SKELETOR_CLI_TEST = '1';

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkFlagCombinations, parseArgs, REMOVED_FLAGS, UsageError } from '../src/args.js';
import { checkTemplateOptions, getTemplatesWithManifests, printPostScaffoldSteps, runNew } from '../src/index.js';
import { loadBundles } from '../src/layers.js';
import { closestMatch, unknownIdMessage } from '../src/suggest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'index.js');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const argv = (...args) => ['node', 'skeletor', ...args];
const template = (id) => getTemplatesWithManifests().find((t) => t.id === id);

function runCli(args, cwd) {
  const env = { ...process.env };
  delete env.JEST_WORKER_ID;
  delete env.SKELETOR_CLI_TEST;
  try {
    const stdout = execFileSync(process.execPath, [SRC, ...args], { cwd, env, stdio: 'pipe' }).toString();
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: `${e.stdout ?? ''}`, stderr: `${e.stderr ?? ''}` };
  }
}

function captureLog(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = orig;
    })
    .then(() => lines.join('\n'));
}

describe('parseArgs rejects what it does not recognize', () => {
  test('an unknown option is an error, with a suggestion when one is close', () => {
    expect(() => parseArgs(argv('new', 'my-app', '--tempalte', 'go'))).toThrow(UsageError);
    expect(() => parseArgs(argv('new', 'my-app', '--tempalte', 'go'))).toThrow('Unknown option "--tempalte". Did you mean "--template"?');
    expect(() => parseArgs(argv('new', 'my-app', '--frobnicate'))).toThrow(/^Unknown option "--frobnicate"\. Run "skeletor --help"/);
    expect(() => parseArgs(argv('new', 'my-app', '-x'))).toThrow('Unknown option "-x"');
  });

  test.each(Object.keys(REMOVED_FLAGS))('removed flag %s says what replaced it', (flag) => {
    expect(() => parseArgs(argv('new', 'my-app', flag))).toThrow(`${flag} was removed: ${REMOVED_FLAGS[flag]}.`);
  });

  test('the removal messages name the replacement', () => {
    expect(REMOVED_FLAGS['--with-recommended']).toMatch(/baseline layers are always applied/);
    expect(REMOVED_FLAGS['--codeowners']).toMatch(/CODEOWNERS/);
    expect(REMOVED_FLAGS['--uv']).toMatch(/always use uv/);
  });

  test('an unknown command is an error, with a suggestion', () => {
    expect(() => parseArgs(argv('nwe', 'my-app'))).toThrow('Unknown command "nwe". Did you mean "new"?');
    expect(() => parseArgs(argv('foo'))).toThrow(/^Unknown command "foo"\. Usage:/);
  });

  test('a value option without a value is an error', () => {
    expect(() => parseArgs(argv('new', 'my-app', '--template'))).toThrow('--template needs a value.');
    expect(() => parseArgs(argv('new', 'my-app', '--template', '--auto'))).toThrow('--template needs a value.');
    expect(() => parseArgs(argv('new', 'my-app', '--owner='))).toThrow('--owner needs a value.');
  });

  test('a single-value option given twice is an error; --with accumulates', () => {
    expect(() => parseArgs(argv('new', 'my-app', '--template', 'go', '-t', 'rust'))).toThrow('--template was given more than once.');
    expect(parseArgs(argv('new', 'my-app', '--with', 'zod-config', '--with', 'free-port,log-table')).withLayers).toEqual(['zod-config', 'free-port', 'log-table']);
  });

  test('a second positional argument is an error', () => {
    expect(() => parseArgs(argv('new', 'my-app', 'extra'))).toThrow('Unexpected argument "extra"');
  });

  test('a boolean option takes no value', () => {
    expect(() => parseArgs(argv('new', 'my-app', '--auto=yes'))).toThrow('--auto takes no value.');
  });

  test('--option=value works for value options', () => {
    const result = parseArgs(argv('new', 'my-app', '--template=go', '--description=a=b'));
    expect(result.template).toBe('go');
    expect(result.description).toBe('a=b');
  });

  test('the project name can come after options', () => {
    expect(parseArgs(argv('new', '--template', 'go', 'my-app')).name).toBe('my-app');
  });

  test('--version and -v ask for the version; --help wins over everything', () => {
    expect(parseArgs(argv('--version')).command).toBe('version');
    expect(parseArgs(argv('-v')).command).toBe('version');
    expect(parseArgs(argv('new', 'my-app', '--version')).command).toBe('version');
    expect(parseArgs(argv('new', 'my-app', '--bogus', '--help')).command).toBe('help');
    expect(parseArgs(argv()).command).toBe('help');
  });
});

describe('closestMatch', () => {
  test('a layer directory name finds the layer id', () => {
    expect(closestMatch('test-harness-playwright', ['test-harness:playwright', 'test-harness:mongo-memory'])).toBe('test-harness:playwright');
  });

  test('typos, swapped letters and unique prefixes match', () => {
    expect(closestMatch('pyhton', ['python', 'go', 'rust'])).toBe('python');
    expect(closestMatch('workspce', ['single', 'lib', 'workspace'])).toBe('workspace');
    expect(closestMatch('types', ['javascript', 'typescript'])).toBe('typescript');
  });

  test('nothing close gives no suggestion', () => {
    expect(closestMatch('cobol', ['python', 'go', 'rust'])).toBeNull();
    expect(closestMatch('', ['python'])).toBeNull();
  });

  test('unknownIdMessage lists the valid ids', () => {
    expect(unknownIdMessage('template', 'pyhton', ['go', 'python'], { label: 'Templates' })).toBe(
      'Unknown template "pyhton". Did you mean "python"?\n   Templates: go, python'
    );
  });
});

describe('flag combinations', () => {
  test('--github needs git', () => {
    expect(checkFlagCombinations({ github: true, git: false })).toMatch(/--github .* needs git/);
  });

  test('--private needs --github', () => {
    expect(checkFlagCombinations({ githubPrivate: true, git: true })).toMatch(/--private .* add --github/);
  });

  test('parseArgs rejects them', () => {
    expect(() => parseArgs(argv('new', 'my-app', '--github', '--no-git'))).toThrow(UsageError);
    expect(() => parseArgs(argv('new', 'my-app', '--private'))).toThrow(UsageError);
  });

  test('supported combinations pass', () => {
    expect(checkFlagCombinations({ github: true, githubPrivate: true, git: true })).toBeNull();
    expect(checkFlagCombinations({ git: false })).toBeNull();
  });
});

describe('options that depend on the template', () => {
  test('--layout on a template without layouts is an error that names the templates with layouts', () => {
    const message = checkTemplateOptions({ layout: 'src' }, template('go'));
    expect(message).toMatch(/^--layout doesn't apply to go/);
    expect(message).toContain('python (flat, src)');
    expect(message).toContain('rust (single, lib, workspace)');
  });

  test('an unknown layout lists the layouts, with a suggestion', () => {
    expect(checkTemplateOptions({ layout: 'workspce' }, template('rust'))).toBe(
      'Unknown layout "workspce". Did you mean "workspace"?\n   Layouts for rust: single, lib, workspace'
    );
  });

  test('a layer directory name suggests the layer id and lists the feature layers', () => {
    const message = checkTemplateOptions({ withLayers: ['test-harness-playwright'] }, template('typescript'));
    expect(message).toMatch(/^Unknown layer "test-harness-playwright"\. Did you mean "test-harness:playwright"\?/);
    expect(message).toMatch(/Feature layers for typescript: .*zod-config/);
    expect(message).not.toMatch(/Feature layers for typescript: .*governance/);
  });

  test('a layer that does not fit the template is an error', () => {
    expect(checkTemplateOptions({ withLayers: ['zod-config'] }, template('go'))).toBe(
      'Layer "zod-config" doesn\'t apply to go.\n   Feature layers for go: docs-policy, issue-labels'
    );
  });

  test('a bundle for another template is an error', () => {
    expect(checkTemplateOptions({ bundle: 'ts-library' }, template('javascript'))).toMatch(/^Bundle "ts-library" is for the typescript template, not javascript/);
  });

  test('valid options pass', () => {
    expect(checkTemplateOptions({ layout: 'src', withLayers: [] }, template('python'))).toBeNull();
    expect(checkTemplateOptions({ withLayers: ['zod-config', 'governance'], bundle: 'ts-library' }, template('typescript'))).toBeNull();
  });

  test("every bundle and its feature layers pass for the bundle's template", () => {
    for (const [name, bundle] of Object.entries(loadBundles())) {
      expect({ name, error: checkTemplateOptions({ bundle: name, withLayers: bundle.layers }, template(bundle.template)) }).toEqual({ name, error: null });
    }
    // express-server is javascript-only, like the express-api bundle that uses it.
    expect(checkTemplateOptions({ bundle: 'express-api', withLayers: ['express-server'] }, template('javascript'))).toBeNull();
    expect(checkTemplateOptions({ withLayers: ['express-server'] }, template('typescript'))).toMatch(/^Layer "express-server" doesn't apply to typescript/);
  });
});

describe('the CLI', () => {
  let cwd;
  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-cli-'));
  });
  afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));

  test.each(['--version', '-v'])('%s prints the package version', (flag) => {
    const { status, stdout } = runCli([flag], cwd);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe(VERSION);
  });

  test.each([
    [['new', 'my-app', '--auto', '--template', 'go', '--uv'], '--uv was removed'],
    [['new', 'my-app', '--auto', '--tempalte', 'go'], 'Did you mean "--template"?'],
    [['new', 'my-app', '--auto', '--owner', 'my-org', '--template', 'pyhton'], 'Did you mean "python"?\n   Templates: csharp, go,'],
    [['new', 'my-app', '--auto', '--owner', 'my-org', '--template', 'go', '--layout', 'src', '--no-git'], "--layout doesn't apply to go"],
    [['new', 'my-app', '--auto', '--owner', 'my-org', '--template', 'go', '--github', '--no-git'], '--github creates the repository'],
    [['new', 'my-app', '--auto', '--owner', 'my-org', '--bundle', 'ts-libary', '--no-git'], 'Did you mean "ts-library"?'],
    [['new', '--auto', '-t', 'go', '-o', 'my-org'], 'The project name is missing: skeletor new <name> [options].'],
  ])('%j exits 1 before writing anything', (args, message) => {
    const { status, stderr } = runCli(args, cwd);
    expect(status).toBe(1);
    expect(stderr).toContain(message);
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  test.each([
    ['a file', (target) => fs.writeFileSync(target, 'x'), '"my-app" already exists and is not a directory'],
    ['a non-empty directory', (target) => fs.mkdirSync(path.join(target, 'src'), { recursive: true }), 'Target directory "my-app" already exists and is not empty'],
  ])('a name taken by %s is an error, and nothing is written', (_what, occupy, message) => {
    const target = path.join(cwd, 'my-app');
    occupy(target);
    const before = fs.statSync(target).isDirectory() ? fs.readdirSync(target) : null;
    const { status, stdout, stderr } = runCli(['new', 'my-app', '--auto', '-t', 'go', '-o', 'my-org', '--no-git'], cwd);
    expect(status).toBe(1);
    expect(stderr).toContain(message);
    expect(stderr).not.toContain('ENOTDIR');
    expect(stdout).not.toContain('Creating');
    if (before) expect(fs.readdirSync(target)).toEqual(before);
  });

  test('layers a requested layer requires are listed as auto-added, and applied in order', () => {
    const { status, stdout } = runCli(['new', 'my-app', '--auto', '-t', 'javascript', '-o', 'my-org', '--no-git', '--with', 'logger-winston'], cwd);
    expect(status).toBe(0);
    expect(stdout).toContain('Applying layers: governance, dependabot, issue-templates, quality-gates, docs-lint, zod-config, logger-winston');
    expect(stdout).toContain('Auto-added required layers: zod-config');
  });
});

describe('next steps match the generated state', () => {
  test('cd comes first under Next steps, and an install step says to commit its lockfile', async () => {
    const out = await captureLog(() => printPostScaffoldSteps('my-app', ['npm install', 'npm test']));
    const lines = out.split('\n');
    expect(lines.slice(0, 5)).toEqual([
      '   Next steps:',
      '     cd my-app',
      '     npm install',
      '       Commit the package-lock.json it creates: CI installs with npm ci.',
      '     npm test',
    ]);
    expect(out).not.toMatch(/or equivalent|Happy scaffolding/);
  });

  test('printPostScaffoldSteps lists repository-only commands apart', async () => {
    const out = await captureLog(() => printPostScaffoldSteps('my-app', ['npm install'], ['npm run lint:encoding']));
    const [steps, later] = out.split('Once the project is a git repository');
    expect(steps).toContain('npm install');
    expect(steps).not.toContain('lint:encoding');
    expect(later).toContain('npm run lint:encoding');
  });

  test.each([
    [false, false],
    [true, true],
  ])('git: %s puts lint:encoding in the next steps: %s', async (git, inSteps) => {
    const name = `next-steps-${git}-${Date.now()}`;
    const targetDir = path.resolve(process.cwd(), name);
    try {
      const out = await captureLog(() => runNew({ command: 'new', name, template: 'javascript', owner: 'my-org', auto: true, git, withLayers: [] }));
      const steps = out.split('Next steps:')[1].split('Once the project')[0];
      expect(steps).toContain('npm install');
      expect(steps).toContain('npm run audit:ci');
      expect(steps.includes('npm run lint:encoding')).toBe(inSteps);
      expect(out.includes('Once the project is a git repository')).toBe(!inSteps);
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});
