import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.SKELETOR_CLI_TEST = '1';

import { getTemplatesWithManifests, runNew } from '../src/index.js';
import {
  applyRuntimeChoices,
  buildPinTokens,
  formatPinnedSpec,
  packageNameToToken,
  validatePinnedVersionsManifest,
  validatePinTokenCoverage,
  checkTemplateGenerationAllowed,
} from '../src/pinned-versions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

describe('pinned-versions', () => {
  const templates = getTemplatesWithManifests();

  test('every template has a valid pinned-versions.json', () => {
    const errors = templates.flatMap((t) => validatePinnedVersionsManifest(
      JSON.parse(fs.readFileSync(path.join(t.dir, 'pinned-versions.json'), 'utf8')),
      t.id,
    ));
    expect(errors).toEqual([]);
  });

  test('pin tokens cover all template references', () => {
    const errors = templates.flatMap((t) => {
      const pinned = JSON.parse(fs.readFileSync(path.join(t.dir, 'pinned-versions.json'), 'utf8'));
      return validatePinTokenCoverage(t.dir, pinned, t);
    });
    expect(errors).toEqual([]);
  });

  test('formatPinnedSpec respects policy', () => {
    expect(formatPinnedSpec({ version: '29.7.0', policy: 'major' })).toBe('^29.7.0');
    expect(formatPinnedSpec({ version: '3.3.3', policy: 'minor' })).toBe('~3.3.3');
    expect(formatPinnedSpec({ version: '0.6.9', policy: 'minor', ecosystem: 'pypi' }, 'pypi')).toBe('>=0.6.9,<0.7.0');
  });

  test('packageNameToToken normalizes scoped names', () => {
    expect(packageNameToToken('@types/node')).toBe('PIN_TYPES_NODE');
    expect(packageNameToToken('typescript-eslint')).toBe('PIN_TYPESCRIPT_ESLINT');
  });

  test('deprecated templates block unless overridden', () => {
    const pinned = { status: 'deprecated', statusMessage: 'Jest 30 migration pending' };
    expect(checkTemplateGenerationAllowed(pinned).blocked).toBe(true);
    expect(checkTemplateGenerationAllowed(pinned, { allowDeprecatedTemplate: true }).allowed).toBe(true);
  });

  test('needs-review templates warn but allow', () => {
    const pinned = { status: 'needs-review', statusMessage: 'Python 3.13 smoke test pending' };
    const result = checkTemplateGenerationAllowed(pinned);
    expect(result.allowed).toBe(true);
    expect(result.warn).toContain('needs review');
  });

  test('generation substitutes pin tokens without leaving skeletor state behind', async () => {
    const name = `pin-snap-${Date.now()}`;
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'go',
        owner: 'pin-owner',
        auto: true,
        git: false,
      });
      expect(fs.existsSync(path.join(targetDir, '.skeletor'))).toBe(false);
      const goMod = fs.readFileSync(path.join(targetDir, 'go.mod'), 'utf8');
      expect(goMod).toContain('go 1.27');
      expect(goMod).not.toContain('{{PIN');
    } finally {
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });

  test('javascript pin tokens populate package.json', () => {
    const tmpl = templates.find((t) => t.id === 'javascript');
    const pinned = JSON.parse(fs.readFileSync(path.join(tmpl.dir, 'pinned-versions.json'), 'utf8'));
    const tokens = buildPinTokens(pinned, tmpl);
    expect(tokens.PIN_JEST).toBe('^30.0.0');
    expect(tokens.PIN_RUNTIME_NODE_ENGINES).toBe('^22.22.2 || >=24.15.0');
  });

  test('runtime pin tokens follow the python version picked at the prompt', () => {
    const tokens = buildPinTokens({ runtime: { python: { version: '3.13' } }, packages: {} });
    expect(applyRuntimeChoices(tokens, { PYTHON_VERSION: '3.12' })).toMatchObject({
      PIN_RUNTIME_PYTHON: '3.12',
      PIN_RUNTIME_PYTHON_RUFF: 'py312',
    });
    expect(applyRuntimeChoices(tokens, { PYTHON_VERSION: '3.14.1' })).toMatchObject({
      PIN_RUNTIME_PYTHON: '3.14',
      PIN_RUNTIME_PYTHON_RUFF: 'py314',
    });
    expect(applyRuntimeChoices(tokens, {})).toMatchObject({ PIN_RUNTIME_PYTHON: '3.13', PIN_RUNTIME_PYTHON_RUFF: 'py313' });
  });

  test('dotnet SDK token follows the chosen target framework', () => {
    const tokens = buildPinTokens({ runtime: { dotnet: { version: '10.0' } }, packages: {} });
    expect(tokens.PIN_TARGET_FRAMEWORK).toBe('net10.0');
    expect(applyRuntimeChoices(tokens, { TARGET_FRAMEWORK: 'net9.0' }).PIN_RUNTIME_DOTNET).toBe('9.0');
    expect(applyRuntimeChoices(tokens, { TARGET_FRAMEWORK: 'net9.0-windows' }).PIN_RUNTIME_DOTNET).toBe('9.0');
    expect(applyRuntimeChoices(tokens, { TARGET_FRAMEWORK: 'netstandard2.0' }).PIN_RUNTIME_DOTNET).toBe('10.0');
  });

  test('runtime choices leave templates without that runtime alone', () => {
    const tokens = buildPinTokens({ runtime: { go: { version: '1.27.0' } }, packages: {} });
    expect(applyRuntimeChoices(tokens, { PYTHON_VERSION: '3.13', TARGET_FRAMEWORK: 'net10.0' })).toEqual(tokens);
  });
});