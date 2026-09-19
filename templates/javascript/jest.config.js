/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.js'],
  // Mirrors _moduleAliases in package.json; module-alias only registers at runtime, not under Jest.
  moduleNameMapper: {
    '^@root/(.*)$': '<rootDir>/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@(config|constants|utils|services|mechanics)$': '<rootDir>/src/$1',
    '^@(config|constants|utils|services|mechanics)/(.*)$': '<rootDir>/src/$1/$2',
  },
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
