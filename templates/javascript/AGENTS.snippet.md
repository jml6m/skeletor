## Code conventions

What the tooling enforces. The [CI workflows](./.github/workflows/) run every Build & Test check on every PR.

- **Gates**: `npm run format:check` (Prettier), `npm run lint` (ESLint, fails on any warning), `npm test` (Jest).
  The pre-commit hook runs Prettier on staged files; `npm run format` formats the whole tree.
- **Imports**: no parent imports (`../`) in `import` or `require()`. Use the `@` aliases (`@config`, `@utils`,
  `@src/...`) or sibling imports (`./`). An alias lives in four places, kept in step: `_moduleAliases` in
  `package.json` (runtime), [jsconfig.json](./jsconfig.json) (ESLint), [jest.config.js](./jest.config.js) and
  `paths` in [knip.json](./knip.json). Unresolved and unused imports are errors.
- **Config**: `process.env` and `process.exit()` are errors outside
  [src/config/env.config.js](./src/config/env.config.js), `scripts/`, `tests/support/`, `release.js` and root
  `*.config.js` files. Read settings from `@config`.
- **Logging**: `console.log`, and any `console` method but `warn`, `error`, `info` and `debug`, warns outside
  `scripts/`, `tests/` and `release.js`; use [src/utils/logger.js](./src/utils/logger.js). Logger messages are
  static strings (a template literal warns); pass values as metadata.
- **Errors**: an empty `catch` block is an error.
- **Tests**: `tests/**/*.test.js` (or `__tests__/`), run by Jest.
- **Health**: `npm run health:dead` (knip) fails on unused files, exports, dependencies and config hints;
  `npm run health:circular` (madge on `src/`) fails on a circular import (CI only, never a git hook).
  `npm run report:dupes` (jscpd on `src/`) is a report and never fails.
