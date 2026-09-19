const { createDefaultEsmPreset } = require('ts-jest');

/** @type {import('jest').Config} */
module.exports = {
  ...createDefaultEsmPreset(),
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/__tests__/**/*.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^#(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};