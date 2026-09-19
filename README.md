# Skeletor

**Multi-language project scaffolding with composable enhancement layers and AGENTS.md built in.**

Generates projects pre-configured with lint/format/health/release defaults (JS/TS encode real workspace conventions; other stacks ship clean baselines).

```bash
npx @jml6m/skeletor new my-api --template typescript --with-recommended
```

Latest release: [![npm](https://img.shields.io/npm/v/@jml6m/skeletor)](https://www.npmjs.com/package/@jml6m/skeletor) (`npm view @jml6m/skeletor version`).

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
- `--github` / `--private` — create the GitHub repo with `gh`, push the initial commit, and seed layer labels
- `--codeowners` — generate a scoped `.github/CODEOWNERS` (interactive: pick from recommended paths; `--auto`: full candidate set)

Interactive prompts use **select lists** with `(recommended)` labels.

## Enhancement layers

Applied at scaffold time only — via `--with`, `--with-recommended`, or `--bundle` on `skeletor new` (see [Common flags](#common-flags) above). Skeletor is a one-shot generator: it writes a project once and leaves nothing of its own behind to track or manage afterward.

| Layer | Applies to | Recommended | What it adds |
|---|---|---|---|
| `dependabot` | all | yes | Grouped, monthly, single-PR Dependabot updates for the template's ecosystem + github-actions, matching the account-wide baseline |
| `docs-lint` | javascript, typescript | yes | Pinned docs-lint CI matching the account baseline: lychee 0.24.2 link/anchor checking + markdownlint-cli2 |
| `env-example` | javascript, typescript | yes | Ships a comprehensive .env.example with documented variables |
| `free-port` | javascript, typescript |  | Zero-dependency cross-platform port freeing script with prestart hook and port registry |
| `governance` | all | yes | Appends agent governance protocols (issue workflow, test-before-handoff) to AGENTS.md |
| `issue-labels` | all |  | Opt-in label conventions for repos with CI/release process: a chore label, the area: prefix rule, and criteria for gate labels |
| `issue-templates` | all | yes | Minimal repo-agnostic issue forms: bug report, feature request, epic (native sub-issues), and blank issues disabled |
| `library-publishing` | typescript |  | Turns a TS template into a dual ESM/CJS npm library with tsup, exports map, prepublishOnly gate, and OIDC publish workflow |
| `log-table` | javascript, typescript |  | cli-table3 + string-width log table utility with display-width truncation and config defaults |
| `logger-winston` | javascript, typescript |  | Replaces the console logger stub with Winston (levels, file transports, env-aware default level) |
| `quality-gates` | javascript, typescript | yes | Adds audit:ci (prod-only high/critical), lint:encoding (UTF-8/BOM/CRLF guard), and git:pull |
| `test-harness:mongo-memory` | javascript, typescript |  | Jest harness with mongodb-memory-server, per-worker isolation, and shared seed helpers |
| `test-harness:playwright` | javascript, typescript |  | Playwright config with mock/real project split, fixtures, and screenshot helper stubs |
| `zod-config` | javascript, typescript | yes | Zod-validated env.config + config/index pattern; never read process.env in feature code |

`skeletor new --github` also creates the labels that the chosen layers expect (for example `epic`), right after it creates the repo.

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
