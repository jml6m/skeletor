# Skeletor

**Multi-language project scaffolding with composable enhancement layers and AGENTS.md built in.**

Generates projects pre-configured with lint/format/health/release defaults (JS/TS encode real workspace conventions; other stacks ship clean baselines).

```bash
npx @jml6m/skeletor new my-api --template typescript --with-recommended
```

Current release: **v0.2.x** on npm (`latest`).

## Available Templates

Run `skeletor new my-project` for an interactive selector, or pass `--template <id>`.

| Template | Notes |
|----------|-------|
| `javascript` | CJS — Prettier, ESLint, aliases, health tools, husky, AGENTS.md |
| `typescript` | ESM + strict TS, flat ESLint, build, quality gates, AGENTS.md |
| `python` | pyproject.toml, ruff, pytest, mypy, src layout |
| `go` | Standard module + tests |
| `rust` | Cargo — `--layout single\|lib\|workspace` |
| `java` | Maven + JUnit 5 |
| `csharp` | .NET 8 + xUnit |

Each template declares `verifyCommands` in `template.json` — the post-scaffold steps to run locally. CI runs them in the `verify-templates` job.

## Quick start

```bash
# Interactive
npx @jml6m/skeletor new my-project

# TypeScript + recommended enhancement layers
npx @jml6m/skeletor new my-api --template typescript --with-recommended

# Non-interactive — pass --owner when auto-detection cannot run
npx @jml6m/skeletor new my-service --auto --template go --owner acme-corp
```

### Common flags

- `--template <id>` — stack to scaffold
- `--with-recommended` / `--with <layers>` / `--bundle <name>` — enhancement layers
- `--owner <user>` — skips GitHub owner auto-detection
- `--description <text>` — optional (generic default when omitted)
- `--auto` — non-interactive; requires `--template`
- `--no-git` — skip `git init`
- `--codeowners` — generate a scoped `.github/CODEOWNERS` (interactive: pick from recommended paths; `--auto`: full candidate set)

Interactive prompts use **select lists** with `(recommended)` labels. `enhance` blocks dirty git trees unless `--allow-dirty`.

## Enhancement layers (v0.2+)

Apply during `new` or later via `enhance`:

```bash
skeletor enhance --add governance,quality-gates
skeletor enhance --list
```

Layers are recorded in `.skeletor/manifest.json`.

## Rich interactive CLI

`@clack/prompts` drives template selection, owner detection (git remote → package.json → gh CLI), layer prompts, and confirmations.

## Philosophy

- Developers **pick** language + flavor.
- Personal conventions live in JS/TS templates; other stacks start from solid defaults.
- Add templates under `templates/<id>/` — auto-discovered by CLI and tests.
- Dependency manifests in templates use `.tmpl` suffix (see root `AGENTS.md`).

## Development

```bash
npm install
npm test                  # fast — generation + contract checks
npm run test:verify       # full — runs each template's verifyCommands (needs toolchains)
npm run lint:encoding
```

## Releasing

Tag-driven CI publish uses npm **Trusted Publishing**. See **[docs/RELEASE.md](./docs/RELEASE.md)**.

## Links

- npm: [@jml6m/skeletor](https://www.npmjs.com/package/@jml6m/skeletor)
- GitHub: [jml6m/skeletor](https://github.com/jml6m/skeletor)

Feedback welcome via GitHub issues.
