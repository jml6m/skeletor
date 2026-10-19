## Code conventions

What the tooling enforces. The [CI workflows](./.github/workflows/) run every Build & Test check on every PR.

- **Gates**: `npm run format:check` (Prettier), `npm run lint` (ESLint with typescript-eslint recommended +
  stylistic, fails on any warning), `npm run typecheck` (`tsc --noEmit`, strict), `npm run build`, `npm test`
  (Jest via ts-jest, ESM). The pre-commit hook runs Prettier on staged files; `npm run format` formats the whole
  tree.
- **Imports**: no parent imports (`..`, `../`). Use subpath imports (`#utils/logger.js`, `#config/index.js`) or sibling
  imports (`./`), with the `.js` extension. `#*` resolves to `src/` through `paths` in
  [tsconfig.json](./tsconfig.json) (typecheck, Jest, knip) and the `types` condition of `imports` in `package.json`
  (dependency-cruiser, so a stale `dist/` can't hide a cycle), and to `dist/` through its `default` condition
  (runtime). Unused imports are errors.
- **Config**: `process.env` is an error outside [src/config/env.config.ts](./src/config/env.config.ts),
  `tests/support/` and root `*.config.ts` files. Read settings from `#config/index.js`.
- **Logging**: `console.log` is an error, and any other `console` method but `warn`, `error`, `info` and `debug`
  warns, so both fail lint; use [src/utils/logger.ts](./src/utils/logger.ts). Logger messages are static strings
  (a template literal warns); pass values as metadata.
- **Types and errors**: `any` warns; empty functions and empty `catch` blocks are errors.
- **Tests**: `tests/**/*.test.ts` (or `__tests__/`), run by Jest.
- **Health**: `npm run health:dead` (knip) fails on unused files, exports, dependencies and config hints;
  `npm run health:circular` (dependency-cruiser on `src/`) fails on a circular import or an import that doesn't
  resolve (CI only, never a git hook). If a cycle can't be broken, report it on the PR; once a maintainer accepts
  it, record it with `npx depcruise src --baseline` (commit the `.dependency-cruiser-known-violations.json` it
  writes) and change the script to `depcruise src --ignore-known`, so only a new cycle fails.
  `npm run report:dupes` (jscpd on `src/`) is a report and never fails.
