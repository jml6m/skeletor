// IMPORTANT: set before importing src so the guard in src/index.js skips main() + process.exit
process.env.SKELETOR_CLI_TEST = '1';

import {
  parseArgs,
  render,
  renderPathSegment,
  buildRenderVars,
  getAvailableTemplates,
  printPostScaffoldSteps,
  labelHint,
} from '../src/index.js';
import { buildLabelSeed } from '../src/layers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('skeletor CLI pure functions', () => {
  test('parseArgs handles basic new command', () => {
    const argv = ['node', 'skeletor', 'new', 'my-cool-api'];
    const result = parseArgs(argv);
    expect(result.command).toBe('new');
    expect(result.name).toBe('my-cool-api');
    expect(result.template).toBe(null); // resolved later / interactively
    expect(result.auto).toBe(false);
    expect(result.git).toBe(true);
  });

  test('parseArgs handles --with-recommended', () => {
    const result = parseArgs(['node', 'skeletor', 'new', 'my-api', '--template', 'typescript', '--with-recommended', '--auto']);
    expect(result.withRecommended).toBe(true);
    expect(result.template).toBe('typescript');
  });

  test('parseArgs handles --github --private and --uv', () => {
    const result = parseArgs([
      'node', 'skeletor', 'new', 'demo',
      '--template', 'python',
      '--auto',
      '--github',
      '--private',
      '--uv',
    ]);
    expect(result.github).toBe(true);
    expect(result.githubPrivate).toBe(true);
    expect(result.uv).toBe(true);
  });

  test('parseArgs handles --codeowners', () => {
    const result = parseArgs(['node', 'skeletor', 'new', 'demo', '--template', 'go', '--auto', '--codeowners']);
    expect(result.codeowners).toBe(true);
  });

  test('renderPathSegment substitutes tokens in paths', () => {
    const vars = { JAVA_PACKAGE_PATH: 'io/github/acme' };
    expect(renderPathSegment('{{JAVA_PACKAGE_PATH}}', vars)).toBe('io/github/acme');
    expect(renderPathSegment('file.tmpl', vars)).toBe('file');
  });

  test('parseArgs respects flags', () => {
    const argv = [
      'node', 'skeletor', 'new', 'demo',
      '--template', 'typescript',
      '--owner', 'acme',
      '--description', 'A test project',
      '--auto',
      '--no-git'
    ];
    const result = parseArgs(argv);
    expect(result.name).toBe('demo');
    expect(result.template).toBe('typescript');
    expect(result.owner).toBe('acme');
    expect(result.description).toBe('A test project');
    expect(result.auto).toBe(true);
    expect(result.git).toBe(false);
  });

  test('buildRenderVars requires owner', () => {
    expect(() => buildRenderVars({ name: 'app' })).toThrow('owner is required');
  });

  test('buildRenderVars includes REPO_URL', () => {
    const vars = buildRenderVars({ name: 'tbra', owner: 'jml6m', description: 'Test' });
    expect(vars.REPO_URL).toBe('https://github.com/jml6m/tbra');
  });

  test('pyproject.toml gets a PEP 639 license only for an SPDX license', () => {
    const license = (LICENSE) => buildRenderVars({ name: 'my-app', owner: 'o', extra: { LICENSE } }).PYPROJECT_LICENSE;
    expect(license('UNLICENSED')).toBe('');
    expect(license('')).toBe('');
    expect(license('MIT')).toBe('\nlicense = "MIT"');
    expect(license('Apache-2.0')).toBe('\nlicense = "Apache-2.0"');
    expect(buildRenderVars({ name: 'my-app', owner: 'o' }).PYPROJECT_LICENSE).toBe('');
  });

  test('printPostScaffoldSteps lists all verify commands', () => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      printPostScaffoldSteps('my-app', ['cargo check', 'cargo test']);
    } finally {
      console.log = orig;
    }
    expect(logs.some((l) => l.includes('cargo check'))).toBe(true);
    expect(logs.some((l) => l.includes('cargo test'))).toBe(true);
    expect(logs.some((l) => l.includes('Next steps:'))).toBe(true);
  });

  test('labelHint lists each expected label once with the command that creates it', () => {
    const hint = labelHint([
      { name: 'epic', color: '3E4B9E', description: 'Tracks a set of child issues' },
      { name: 'chore', color: 'EDEDED', description: 'Say "hi" for $5' },
      { name: 'epic', color: '3E4B9E', description: 'Tracks a set of child issues' },
    ]);
    expect(hint).not.toContain('AGENTS.md');
    expect(hint.split('\n')).toEqual([
      'Layers expect these labels on GitHub: epic, chore. --github creates them; otherwise run:',
      '  gh label create "epic" --color 3E4B9E --description "Tracks a set of child issues" --force',
      '  gh label create "chore" --color EDEDED --description "Say \\"hi\\" for \\$5" --force',
    ]);
  });

  test('labelHint prints the same commands as the AGENTS.md "Issue labels" seed', () => {
    const labels = [
      { name: 'epic', color: '3E4B9E', description: 'Tracks a set of child issues' },
      { name: 'chore', color: 'fef2c0', description: 'Maintenance / process work' },
    ];
    const hintCommands = labelHint(labels).split('\n').slice(1).map((line) => line.trim());
    const seedCommands = buildLabelSeed(labels).split('\n').filter((line) => line.startsWith('gh label create'));
    expect(hintCommands).toEqual(seedCommands);
  });

  test('parseArgs falls back to help for unknown', () => {
    const result = parseArgs(['node', 'skeletor', 'foo']);
    expect(result.command).toBe('help');
  });

  test('render replaces all tokens', () => {
    const template = 'Project {{PROJECT_NAME}} owned by {{REPO_OWNER}}/{{REPO_NAME}} in {{YEAR}}';
    const vars = {
      PROJECT_NAME: 'test-app',
      REPO_OWNER: 'jml6m',
      REPO_NAME: 'test-app',
      YEAR: 2026,
    };
    const out = render(template, vars);
    expect(out).toBe('Project test-app owned by jml6m/test-app in 2026');
  });

  test('buildRenderVars derives stack-specific tokens', () => {
    const vars = buildRenderVars({
      name: 'my-cool-app',
      owner: 'jml6m',
      description: 'Demo',
    });
    expect(vars.NAMESPACE).toBe('my_cool_app');
    expect(vars.GROUP_ID).toBe('io.github.jml6m');
    expect(vars.GO_MODULE).toBe('github.com/jml6m/my-cool-app');
  });

  test('getAvailableTemplates discovers the maintained templates', () => {
    const templates = getAvailableTemplates();
    expect(templates).toEqual(expect.arrayContaining(['javascript', 'typescript', 'python']));
  });
});
