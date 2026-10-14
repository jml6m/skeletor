# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Standards

This project was scaffolded with [skeletor](https://github.com/jml6m/skeletor) and follows personal conventions extracted from active workspaces:

- Prettier + organize-imports + pkg plugin (printWidth 165, 2 spaces, single quotes)
- ESLint + typescript-eslint + unused-imports (strict), plus:
  - no parent relative imports (`../*`): use subpath imports (`#utils/...`) or siblings (`./`)
  - no `process.env` outside [src/config/env.config.ts](./src/config/env.config.ts), `tests/support/` and root `*.config.ts` files: read config from `#config`
  - no `console.log`: use the logger
  - no template literals in logger messages (warning): pass dynamic values as metadata, `logger.info('Event', { key: value })`
- Knip (dead code), jscpd (dupes), madge (circular) via `npm run health:full`
- Custom `release.js` (one bump per PR, major gates via GitHub issue labels `vN-required`)
- AGENTS.md as the Single Source of Truth for coding standards + AI agent protocols
- Native Node subpath imports (`import logger from '#utils/logger.js'`): `tsconfig.json` `paths` resolves them to `src/` for type-checking and Jest, and `package.json` `imports` resolves them to the compiled `dist/` at runtime

See [AGENTS.md](./AGENTS.md) for the full contract.

## Quick start

```bash
npm install
npm run format
npm run lint
npm run typecheck
npm run build
npm test
npm start
npm run health:full
```

## Release flow (per conventions)

- Open PR → run `npm run release:patch` **once** at PR creation
- `npm run release:minor` only for substantial features (coordinate)
- Majors are human-only and gated by open issues labeled `vX-required`

## Tooling scripts

- `npm run npm:reinstall` — clean node_modules + lock then fresh install
- `npm run health:*` — quality gates
