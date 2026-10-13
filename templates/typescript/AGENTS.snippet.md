## Code conventions

What the tooling enforces. [CI](./.github/workflows/ci.yml) runs every Build & Test check on every PR.

- **Gates**: `npm run format:check` (Prettier), `npm run lint` (ESLint with typescript-eslint recommended +
  stylistic, fails on any warning), `npm run typecheck` (`tsc --noEmit`, strict), `npm run build`, `npm test`
  (Jest via ts-jest, ESM). The pre-commit hook runs Prettier on staged files; `npm run format` formats the whole
  tree.
- **Imports**: no parent imports (`../`). Use subpath imports (`#utils/logger.js`, `#config/index.js`) or sibling
  imports (`./`), with the `.js` extension. `#*` resolves to `src/` through `paths` in
  [tsconfig.json](./tsconfig.json) (typecheck, Jest) and to `dist/` through `imports` in `package.json`
  (runtime). Unused imports are errors.
- **Config**: `process.env` is an error outside [src/config/env.config.ts](./src/config/env.config.ts),
  `tests/support/` and root `*.config.ts` files. Read settings from `#config/index.js`.
- **Logging**: `console.log` is an error; use [src/utils/logger.ts](./src/utils/logger.ts). Logger messages are
  static strings (a template literal warns); pass values as metadata.
- **Types and errors**: `any` warns; empty functions and empty `catch` blocks are errors.
- **Tests**: `tests/**/*.test.ts` (or `__tests__/`), run by Jest.
- **Health**: `npm run health:dead` (knip) fails on unused files, exports, dependencies and config hints;
  `npm run health:circular` (madge on `src/`) fails on a circular import (CI only, never a git hook).
  `npm run report:dupes` (jscpd on `src/`) is a report and never fails.
