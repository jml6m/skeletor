// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

const PARENT_IMPORT_MESSAGE = 'Do not use parent imports. Use subpath imports (e.g. #utils/logger.js, #config/index.js) or sibling imports (./).';

export default defineConfig([
  {
    // Generated output (keep in step with the build/output entries in .gitignore), then JS tooling files.
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'report/**',
      'reports/**',
      '.jscpd/**',
      'playwright-report/**',
      'test-results/**',
      'eslint.config.js',
      'scripts/**/*.js',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    plugins: {
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-empty-function': 'error',

      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.object.name='logger'][callee.property.name=/^(info|warn|error|debug|http|log)$/] > TemplateLiteral:first-child",
          message:
            "Avoid template literals in logger messages. Use a static string and pass variables as metadata: logger.info('Event description', { key: value })",
        },
      ],
      'no-restricted-imports': ['error', { patterns: [{ group: ['../*'], message: PARENT_IMPORT_MESSAGE }] }],
      'no-restricted-properties': [
        'error',
        {
          object: 'console',
          property: 'log',
          message: 'Use structured logger instead of console.log.',
        },
        {
          object: 'process',
          property: 'env',
          message: 'Use #config (or equivalent) instead of process.env directly.',
        },
      ],

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Where process.env is legitimately read or set: the config module, test harness setup, and root tool configs (e.g. CI flags).
    files: ['src/config/env.config.ts', 'tests/support/**', '*.config.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
]);
