const path = require('path');
const js = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const { createTypeScriptImportResolver } = require('eslint-import-resolver-typescript');
const importX = require('eslint-plugin-import-x');
const nodePlugin = require('eslint-plugin-n');
const unusedImports = require('eslint-plugin-unused-imports');
const globals = require('globals');

const PARENT_IMPORT_MESSAGE = 'Do not use parent imports. Use architectural aliases (e.g. @services, @utils) or sibling imports (./).';

module.exports = defineConfig([
  {
    // Generated output; keep in step with the build/output entries in .gitignore.
    ignores: ['dist/**', 'build/**', 'coverage/**', 'report/**', 'reports/**', '.jscpd/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [js.configs.recommended, importX.flatConfigs.recommended],
    plugins: {
      n: nodePlugin,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      // Resolves the @alias paths declared in jsconfig.json (the same map module-alias uses at runtime).
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: path.join(__dirname, 'jsconfig.json') })],
    },
    rules: {
      'import-x/no-unresolved': ['error', { commonjs: true }],
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.object.name='logger'][callee.property.name=/^(info|warn|error|debug|http|log)$/] > TemplateLiteral:first-child",
          message:
            "Avoid template literals in logger messages. Use a static string and pass variables as metadata: logger.info('Event description', { key: value })",
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-undef': 'error',
      // no-restricted-imports covers `import`; n/no-restricted-require covers `require()`.
      'no-restricted-imports': ['error', { patterns: [{ group: ['../*'], message: PARENT_IMPORT_MESSAGE }] }],
      'n/no-restricted-require': ['error', [{ name: ['..', '../**'], message: PARENT_IMPORT_MESSAGE }]],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Use @config (or equivalent) instead of process.env directly.',
        },
        {
          object: 'process',
          property: 'exit',
          message: 'Direct process.exit() is discouraged. Use error handling or a dedicated shutdown utility.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['knip.config.js', 'release.js', 'scripts/**', 'tests/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['release.js', 'scripts/**', 'tests/support/**', 'src/config/env.config.js'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
]);
