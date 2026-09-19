import { adjustVerifyCommandsForAnswers } from '../src/template-prompts.js';

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
