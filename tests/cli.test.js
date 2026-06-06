// IMPORTANT: set before importing src so the guard in src/index.js skips main() + process.exit
process.env.SKELETOR_CLI_TEST = '1';

import { parseArgs, render, getAvailableTemplates } from '../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('skeletor CLI pure functions', () => {
  test('parseArgs handles basic new command', () => {
    const argv = ['node', 'skeletor', 'new', 'my-cool-api'];
    const result = parseArgs(argv);
    expect(result.command).toBe('new');
    expect(result.name).toBe('my-cool-api');
    expect(result.template).toBe('node');
    expect(result.owner).toBe('jml6m');
    expect(result.git).toBe(true);
  });

  test('parseArgs respects flags', () => {
    const argv = [
      'node', 'skeletor', 'new', 'demo',
      '--template', 'node',
      '--owner', 'acme',
      '--description', 'A test project',
      '--yes',
      '--no-git'
    ];
    const result = parseArgs(argv);
    expect(result.name).toBe('demo');
    expect(result.owner).toBe('acme');
    expect(result.description).toBe('A test project');
    expect(result.yes).toBe(true);
    expect(result.git).toBe(false);
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

  test('getAvailableTemplates finds the node template', () => {
    // This runs from the project root in normal test invocation
    const templates = getAvailableTemplates();
    expect(templates).toContain('node');
  });
});
