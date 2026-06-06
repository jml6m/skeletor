# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Standards

This project was scaffolded with [skeletor](https://github.com/jml6m/skeletor) and follows personal conventions extracted from active workspaces:

- Prettier + organize-imports + pkg plugin (printWidth 165, 2 spaces, single quotes)
- ESLint + unused-imports (strict), no parent relative imports (`../*`)
- Knip (dead code), jscpd (dupes), madge (circular) via `npm run health:full`
- Custom `release.js` (one bump per PR, major gates via GitHub issue labels `vN-required`)
- AGENTS.md as the Single Source of Truth for coding standards + AI agent protocols
- Path aliases (`@src`, `@utils`, etc.) enforced at lint + runtime (module-alias)

See [AGENTS.md](./AGENTS.md) for the full contract.

## Quick start

```bash
npm install
npm run format
npm run lint
npm test
npm run health:full
```

## Release flow (per conventions)

- Open PR → run `npm run release:patch` **once** at PR creation
- `npm run release:minor` only for substantial features (coordinate)
- Majors are human-only and gated by open issues labeled `vX-required`

## Tooling scripts

- `npm run npm:reinstall` — clean node_modules + lock then fresh install
- `npm run prompt:gen` — build prompt.md for AI context (respects excludes)
- `npm run health:*` — quality gates
