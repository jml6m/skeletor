/**
 * Jest config for skeletor (ESM project).
 * Uses experimental VM modules for ESM support in Jest 29.
 */

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  // No transforms - we test mostly pure functions + child_process integration.
  // Because root package.json has "type": "module", .js files are treated as ESM automatically.
  transform: {},
  moduleFileExtensions: ['js', 'json', 'mjs'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js'
  ],
  // Do not run the example tests that live inside the *scaffolded templates*
  testPathIgnorePatterns: ['/templates/', '/layers/'],
  // Prevent Jest haste module name collisions from the template package.json files (they contain {{PROJECT_NAME}})
  modulePathIgnorePatterns: ['<rootDir>/templates/'],
  haste: {
    enableSymlinks: false,
  },
  // Silence some experimental warning noise in CI
  silent: false,
  verbose: true,
};
