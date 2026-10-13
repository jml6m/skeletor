process.env.SKELETOR_CLI_TEST = '1';

import { compareSemverLoose, detectJsonIndent, mergePackageJson, serializePackageJson } from '../src/merge-package-json.js';

describe('mergePackageJson', () => {
  test('unions arrays without duplicates', () => {
    const target = { files: ['lib', 'README.md'] };
    const patch = { files: ['README.md', 'LICENSE'] };
    const merged = mergePackageJson(target, patch);
    expect(merged.files).toEqual(['lib', 'README.md', 'LICENSE']);
  });

  test('deep-merges nested objects', () => {
    const target = { scripts: { lint: 'eslint .' } };
    const patch = { scripts: { test: 'jest' } };
    const merged = mergePackageJson(target, patch);
    expect(merged.scripts).toEqual({ lint: 'eslint .', test: 'jest' });
  });

  test('keeps existing script on collision and records conflict', () => {
    const conflicts = [];
    const target = { scripts: { test: 'jest' } };
    const patch = { scripts: { test: 'mocha' } };
    const merged = mergePackageJson(target, patch, conflicts);
    expect(merged.scripts.test).toBe('jest');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].path).toBe('scripts.test');
  });

  test('keeps higher semver dependency', () => {
    const conflicts = [];
    const target = { dependencies: { zod: '^3.22.0' } };
    const patch = { dependencies: { zod: '^3.23.8' } };
    const merged = mergePackageJson(target, patch, conflicts);
    expect(merged.dependencies.zod).toBe('^3.23.8');
    expect(conflicts).toHaveLength(1);
  });

  test('sets scalar only when absent', () => {
    const conflicts = [];
    const target = { license: 'MIT' };
    const patch = { license: 'ISC', private: true };
    const merged = mergePackageJson(target, patch, conflicts);
    expect(merged.license).toBe('MIT');
    expect(merged.private).toBe(true);
    expect(conflicts).toHaveLength(1);
  });
});

describe('semver helpers', () => {
  test('compareSemverLoose orders versions', () => {
    expect(compareSemverLoose('^3.23.8', '^3.22.0')).toBeGreaterThan(0);
  });
});

describe('serialization', () => {
  test('detectJsonIndent and serialize trailing newline', () => {
    const raw = '{\n  "name": "x"\n}\n';
    expect(detectJsonIndent(raw)).toBe(2);
    expect(serializePackageJson({ name: 'x' }, 2)).toBe('{\n  "name": "x"\n}\n');
  });
});
describe('package.json key order', () => {
  // prettier-plugin-pkg, in the JS/TS scaffolds' Prettier config, prints package.json in this order.
  test('known keys in the plugin order, others alphabetically, and sorted scripts and dependencies', () => {
    const pkg = {
      scripts: { test: 'jest', build: 'tsc' },
      'lint-staged': {},
      main: 'index.js',
      _moduleAliases: {},
      files: ['README.md', 'lib', '!lib/x', 'dist'],
      private: true,
      devDependencies: { zod: '1', ajv: '1' },
      engines: { node: '>=24' },
      name: 'x',
      type: 'module',
    };
    const sorted = JSON.parse(serializePackageJson(pkg));
    expect(Object.keys(sorted)).toEqual(['name', 'type', 'private', 'engines', 'main', 'files', 'scripts', 'devDependencies', '_moduleAliases', 'lint-staged']);
    expect(Object.keys(sorted.scripts)).toEqual(['build', 'test']);
    expect(Object.keys(sorted.devDependencies)).toEqual(['ajv', 'zod']);
    expect(sorted.files).toEqual(['dist', 'lib', 'README.md', '!lib/x']);
  });
});
