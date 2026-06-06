# Skeletor
Efficient scaffolding for custom development.

Generates empty (or lightly stubbed) projects pre-configured with **your** rules and recommendations, derived from analysis of many GitHub-linked workspaces (local-land-client/server, cuda-sandbox, x-app-skeleton, etc.).

## What gets generated (node template)

- Prettier (printWidth 165, single quotes, organize-imports + pkg plugins) — exact match across your projects
- ESLint + `unused-imports` (error), `no-restricted-imports` for `../*`, `no-console` + process.env guards
- jsconfig paths + module-alias runtime aliases (`@src`, `@utils`, `@config`...)
- Knip + jscpd + madge health checks (`npm run health:full`)
- Custom `release.js` with GitHub issue gates for majors + "one bump per PR" flow
- `AGENTS.md` (Single Source of Truth for AI agents, Three-Strike rule, cross-repo protocol, exclusions, logging standards, architecture)
- `scripts/reinstall.js`, `scripts/generate-context.js` (prompt.md builder)
- Husky + lint-staged pre-commit hook (format/lint on staged files)
- Basic `.github/workflows/ci.yml` (lint + test + health on PR/push)
- Basic layered src skeleton + logger stub that demonstrates the no-console / structured metadata rules
- Jest, .editorconfig, .gitignore, etc.

> **Note on modern tooling (2026 context)**: Research shows Biome and Oxlint are rapidly becoming popular faster alternatives to ESLint+Prettier for *new* projects. The current `node` template stays faithful to the exact stack and rules used across your existing workspaces (local-land-*, cuda-sandbox, etc.). Future templates or opt-in flags can add Biome support.

## Usage (alpha)

```bash
# From source during development
node src/index.js new my-api --template node --owner jml6m

# Or after npm link / publish
npx @jml6m/skeletor new my-api --yes
skeletor new my-service
```

Flags:
- `--template node` (only one for now)
- `--owner jml6m`
- `--description "..."` 
- `--yes`
- `--no-git`

After scaffolding:
```bash
cd my-api
npm install
npm run format
npm run lint
npm test
npm run health:full
```

## Philosophy / Goals

- Encode **your** standards once (in this repo's `templates/`) so every new sandbox or real project starts compliant.
- Similar spirit to Yeoman / `create-*-app` but 100% aligned to the specific lint, alias, health, release, agent-protocol, and architecture patterns you actually use and enforce in local-land-* and friends.
- Easy to evolve: edit files under `templates/node/` and the next generated project gets the update.

## Status

Early alpha. The `node` template is the first codification of the common cross-project tooling + quality gates + AI agent contract (heavily informed by deep analysis of your linked workspaces).

More templates (TS + flat eslint / native `package.json#imports`, Angular standalone, Python, fullstack pair, etc.) and richer templating are planned.

Run `skeletor` (or `node src/index.js`) with no args for current help.

## For Testers & Reviewers

### Quick try (no install needed)

```bash
# From a clone of this repo
node src/index.js new my-test-project --yes

cd my-test-project
npm install
npm run format
npm run lint
npm test
npm run health:full
```

Inspect the generated files, especially:
- `AGENTS.md`
- `release.js` (owner/repo substituted)
- `.prettierrc.json`, `.eslintrc.json`, `knip.json`
- `.husky/pre-commit` and `lint-staged` config
- `.github/workflows/ci.yml`
- `src/` structure + alias usage in `src/index.js`
- `package.json` scripts and `_moduleAliases`

### Running the unit + integration test suite

```bash
npm install          # pulls jest (devDep)
npm test
```

The tests cover:
- CLI argument parsing
- Template token rendering (`{{PROJECT_NAME}}` etc.)
- Full generation into temp dirs (verifies file presence, JSON validity, token substitution, new husky/github artifacts, refusal to overwrite, etc.)
- The generated projects are exercised for basic structure (no full `npm install` of heavy tools in every test to keep it fast).

All tests are in `tests/`.

### Updating standards

The single source of truth for "your rules" lives in `templates/node/`.

Edit any file there (package.json scripts/deps, AGENTS.md, eslint config, the CI workflow, the logger example, etc.). The next `skeletor new ...` will emit the updated version.

When you are happy with changes, commit + push (or ask for review).

### GitHub push & external review

After local verification:
- The repo is https://github.com/jml6m/skeletor
- This worktree should be on `main` and can be pushed normally.

Feel free to open issues or PRs against it with feedback like "the generated CI should also run build" or "please add a --typescript flag".

Happy to iterate quickly on the templates based on real usage.