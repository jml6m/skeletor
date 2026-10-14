import js from '@eslint/js';
import globals from 'globals';

export default [
  // Emitted fixtures are checked in the projects they generate, not here.
  { ignores: ['templates/**', 'layers/**', 'coverage/**', 'gen-*/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    // No eslint-disable comments: a rule that needs an exception is narrowed here.
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // File an issue instead of leaving a marker in the code.
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' }],
    },
  },
  { files: ['tests/**'], languageOptions: { globals: globals.jest } },
];
