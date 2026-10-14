import { adjustVerifyCommandsForAnswers, gatherTemplatePrompts } from '../src/template-prompts.js';

process.env.SKELETOR_CLI_TEST = '1';
const { buildRenderVars, getAvailableTemplates } = await import('../src/index.js');

describe('adjustVerifyCommandsForAnswers', () => {
  const flat = [
    'python -m pip install --upgrade "pip>=25.1" --quiet',
    'python -m pip install --group dev --quiet',
    'python -m ruff check .',
    'python -m mypy .',
  ];

  test('leaves pip workflows untouched', () => {
    expect(adjustVerifyCommandsForAnswers(flat, { PYTHON_PACKAGE_MANAGER: 'pip' })).toEqual(flat);
  });

  test('uv collapses installs into one uv sync and runs python through the uv venv', () => {
    expect(adjustVerifyCommandsForAnswers(flat, { PYTHON_PACKAGE_MANAGER: 'uv' })).toEqual([
      'uv sync --all-extras',
      'uv run python -m ruff check .',
      'uv run python -m mypy .',
    ]);
  });
});

describe('gatherTemplatePrompts', () => {
  test('no template asks for a python version, .NET target framework or Maven groupId', () => {
    const fixed = ['pythonVersion', 'targetFramework', 'javaGroupId'];
    for (const id of getAvailableTemplates()) {
      const ids = gatherTemplatePrompts(id).map((pr) => pr.id);
      expect({ id, asked: ids.filter((pid) => fixed.includes(pid)) }).toEqual({ id, asked: [] });
    }
  });

  test('no template asks for author, package manager, Go layout or Rust crate type', () => {
    const removed = ['author', 'authorEmail', 'packageManager', 'goLayout', 'rustCrateType'];
    for (const id of getAvailableTemplates()) {
      const ids = gatherTemplatePrompts(id).map((pr) => pr.id);
      expect({ id, asked: ids.filter((pid) => removed.includes(pid)) }).toEqual({ id, asked: [] });
    }
    const vars = buildRenderVars({ name: 'my-app', owner: 'acme' });
    for (const token of ['AUTHOR', 'AUTHOR_EMAIL', 'PACKAGE_MANAGER', 'GO_LAYOUT', 'RUST_CRATE_TYPE']) {
      expect(Object.hasOwn(vars, token)).toBe(false);
    }
  });
});
