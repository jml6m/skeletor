## Code conventions

What the tooling enforces. [CI](./.github/workflows/ci.yml) runs lint, tests and the health checks on every PR.

- **Gates**: `npm run format` (Prettier), `npm run lint` (ESLint), `npm test` (Jest). The pre-commit hook runs
  Prettier on staged files.
- **Imports**: no parent imports (`../`) in `import` or `require()`. Use the `@` aliases (`@config`, `@utils`,
  `@src/...`) or sibling imports (`./`). An alias lives in three places, kept in step: `_moduleAliases` in
  `package.json` (runtime), [jsconfig.json](./jsconfig.json) (ESLint) and [jest.config.js](./jest.config.js).
  Unresolved and unused imports are errors.
- **Config**: `process.env` and `process.exit()` are errors outside
  [src/config/env.config.js](./src/config/env.config.js), `scripts/`, `tests/support/` and `release.js`. Read
  settings from `@config`.
- **Logging**: `console` warns outside `scripts/`, `tests/` and `release.js`; use
  [src/utils/logger.js](./src/utils/logger.js). Logger messages are static strings (a template literal warns);
  pass values as metadata.
- **Errors**: an empty `catch` block is an error.
- **Tests**: `tests/**/*.test.js` (or `__tests__/`), run by Jest.
- **Health** (report only, never fails the build): `npm run health:full` runs `health:dead` (knip, unused files
  and exports), `health:dupes` (jscpd on `src/`) and `health:circular` (madge on `src/`).
