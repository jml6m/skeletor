# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Standards

This project was scaffolded with [skeletor](https://github.com/jml6m/skeletor) and comes with these conventions:

- Prettier at its default width (80 columns), with single quotes, ES5 trailing commas and the organize-imports and pkg plugins
- ESLint + unused-imports (strict), no parent relative imports (`../*`)
- knip (dead code) and madge (circular imports) gate CI; jscpd (duplicated code) is an on-demand report
- Husky pre-commit hook: lint-staged runs Prettier on staged files; ESLint runs in `npm run lint` and CI
- Custom `release.js` (one bump per PR, major gates via GitHub issue labels `vN-required`)
- AGENTS.md as the Single Source of Truth for coding standards + AI agent protocols
- Path aliases (`@src`, `@utils`, etc.) enforced at lint + runtime (module-alias)

See [AGENTS.md](./AGENTS.md) for the full contract.

## Checks

Every check is a gate, opt-in, or a report.

**Gates** fail the build. [CI](./.github/workflows/ci.yml) runs them on every pull request, and AGENTS.md lists the
same commands:

```bash
{{VERIFY_COMMANDS}}
```

- `format:check` fails on a file Prettier would change. `lint` fails on any ESLint warning (`--max-warnings 0`).
- `health:dead` (knip) fails on unused files, exports and dependencies, and on configuration hints.
- `health:circular` (madge) fails on a circular import. It runs in CI, never in a git hook.
- `audit:ci` fails on a high or critical advisory in a production dependency; `lint:encoding` fails on non-UTF-8
  bytes, a byte-order mark or CRLF line endings in tracked files.
- The [docs-lint](./.github/workflows/docs-lint.yml) workflow checks Markdown links (lychee) and formatting
  (markdownlint, also `npm run lint:docs`).

**Opt-in** checks come with a layer chosen at `skeletor new` time (end-to-end tests, package checks, a Markdown
allowlist). Once added, they're gates and appear in the list above.

**Reports** run on demand and never fail the build: `npm run report:dupes` (jscpd, duplicated code in `src/`) and
`npm run test:coverage`.

The pre-commit hook formats staged files with Prettier, and `npm run format` formats the whole tree.

## Release flow (per conventions)

- Open PR → run `npm run release:patch` **once** at PR creation
- `npm run release:minor` only for substantial features (coordinate)
- Majors are human-only and gated by open issues labeled `vN-required`, where N is the next major version

## Tooling scripts

- `npm run npm:reinstall` — clean node_modules + lock then fresh install
