import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adjustVerifyCommandsForAnswers, gatherTemplatePrompts } from '../src/template-prompts.js';

const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');

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
  test('python offers 3.12-3.13 and defaults to the pinned runtime', () => {
    const prompt = gatherTemplatePrompts('python', { PIN_RUNTIME_PYTHON: '3.13' }).find((pr) => pr.id === 'pythonVersion');
    expect(prompt.options).toEqual(['3.12', '3.13']);
    expect(prompt.default).toBe('3.13');
  });

  test('python never offers a version newer than the pinned runtime', () => {
    const pinned = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, 'python', 'pinned-versions.json'), 'utf8')).runtime.python.version;
    const prompt = gatherTemplatePrompts('python', { PIN_RUNTIME_PYTHON: pinned }).find((pr) => pr.id === 'pythonVersion');
    const minor = (v) => Number(String(v).split('.')[1]);
    for (const option of prompt.options) expect(minor(option)).toBeLessThanOrEqual(minor(pinned));
  });

  test('csharp target framework defaults to the pinned .NET runtime', () => {
    const prompt = gatherTemplatePrompts('csharp', { PIN_TARGET_FRAMEWORK: 'net10.0' }).find((pr) => pr.id === 'targetFramework');
    expect(prompt.default).toBe('net10.0');
  });
});
