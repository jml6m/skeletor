// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default defineConfig([
  {
    ignores: ['dist/**', 'eslint.config.js', 'scripts/**/*.js'],
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
      'no-restricted-properties': [
        'error',
        {
          object: 'console',
          property: 'log',
          message: 'Use structured logger instead of console.log.',
        },
      ],

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
