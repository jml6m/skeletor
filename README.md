# Skeletor

**Multi-language project scaffolding with composable enhancement layers and AGENTS.md built in.**

Generates projects pre-configured with lint/format/test/release defaults: JS/TS templates ship an opinionated toolchain, other stacks start from clean standard defaults.

```bash
npx @jml6m/skeletor new my-api --template typescript
```

Latest release: [![npm](https://img.shields.io/npm/v/@jml6m/skeletor)](https://www.npmjs.com/package/@jml6m/skeletor) (`npm view @jml6m/skeletor version`).

## Available Templates

Run `skeletor new my-project` for an interactive selector, or pass `--template <id>`.

| Template     | Notes                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| `javascript` | CJS — Prettier, ESLint, aliases, knip/madge gates, husky, AGENTS.md          |
| `typescript` | ESM + strict TS, flat ESLint, build, quality gates, AGENTS.md                |
| `python`     | uv, pyproject.toml, ruff, pytest, mypy — `--layout flat\|src` (flat default) |
| `go`         | Standard module + tests                                                      |
| `rust`       | Cargo — `--layout single\|lib\|workspace`                                    |
| `java`       | Maven + JUnit 6                                                              |
| `csharp`     | .NET 10 + xUnit                                                              |

Each template declares `verifyCommands` in `template.json`: the scaffold's checks. A layer can add its own. The generated AGENTS.md and README list them, and the scaffold's CI runs them on every pull request.

Every check a scaffold emits fails CI when it finds a problem, comes with a layer you opt into (then it's a gate too), or is an on-demand report that never runs in CI (`npm run report:dupes`). The `verify-templates` job runs each template's, layer's and bundle's checks.

## Prerequisites

skeletor runs on Node 22 or later. It uses git for the initial commit (`--no-git` skips it) and an authenticated [GitHub CLI](https://cli.github.com/) (`gh`) for `--github`.

A scaffold's checks need its stack's toolchain:

| Template                   | Toolchain                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `javascript`, `typescript` | Node 24.15 or later: the scaffold's `engines` and `devEngines` require it, and skeletor warns on an older Node |
| `python`                   | [uv](https://docs.astral.sh/uv/), which installs the pinned Python                                             |
| `go`                       | Go 1.27 or later                                                                                               |
| `rust`                     | Rust stable, with rustfmt and clippy                                                                           |
| `java`                     | JDK 25 and Maven                                                                                               |
| `csharp`                   | .NET 10 SDK                                                                                                    |

## Quick start

```bash
# Interactive
npx @jml6m/skeletor new my-project

# TypeScript plus feature layers (the baseline layers are always applied)
npx @jml6m/skeletor new my-api --template typescript --with zod-config,logger-winston

# Non-interactive — pass --owner when auto-detection cannot run
npx @jml6m/skeletor new my-service --auto --template go --owner acme-corp
```

The project name is lowercase kebab-case, starting with a letter (e.g. `my-api`), at most 64 characters. It becomes the directory, package and repository name, so it is valid for every template. Other names are rejected with a suggestion: interactive runs ask again, `--auto` exits 1.

### Commands and flags

```text
skeletor new <name> [options]
skeletor --help | -h
skeletor --version | -v
```

`skeletor new` options:

- `--template <id>` / `-t` — stack to scaffold
- `--layout <id>` — template layout: rust `single|lib|workspace`, python `flat|src`
- `--with <layers>` — comma-separated feature layers, on top of the template's baseline layers; can be repeated
- `--bundle <name>` — a named set of feature layers (see [Bundles](#bundles)); it also names the template
- `--owner <user>` / `-o` — skips GitHub owner auto-detection
- `--description <text>` / `-d` — optional (generic default when omitted)
- `--auto` — non-interactive; requires `--template` or `--bundle`
- `--no-git` — skip `git init`. The printed next steps then leave out commands that need a repository and list them separately
- `--github` — create the GitHub repository with `gh`, push the initial commit, seed layer labels, and print the repository's one-time settings (rulesets, merge button). Needs git. Visibility also sets the license (see [Fixed defaults](#fixed-defaults))
- `--private` — make the `--github` repository private (default: public); needs `--github`
- `--allow-deprecated-template` — scaffold a template whose pins are marked `deprecated` in `pinned-versions.json`

Value options also accept `--option=value`.

Without an interactive terminal (CI, a pipe), `skeletor new` needs `--auto`, or it exits 1. Unknown options, removed options (`--with-recommended`, `--codeowners`, `--uv`) and options that don't fit the template (such as `--layout` on a template without layouts, or a layer that doesn't apply to it) are errors. Errors for an unknown template, layout, layer or bundle list the valid ids and suggest the closest one.

Interactive prompts use **select lists** with `(recommended)` labels.

### Fixed defaults

skeletor sets these itself instead of asking. Change them in the generated project if you need to.

| Value                            | Default                                                                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License                          | `UNLICENSED` (no `LICENSE` file, nothing granted) without `--github` or with `--private`. A public `--github` repo is asked: MIT, Apache-2.0 or UNLICENSED; `--auto` picks MIT. With `library-publishing`, MIT unless a public repo's prompt picks another |
| Python version                   | the template's pinned runtime (`pinned-versions.json`)                                                                                                                                                                                                     |
| Python dependency workflow       | uv (`uv sync`, `uv run`); commit the `uv.lock` the first `uv sync` creates                                                                                                                                                                                 |
| .NET target framework            | the template's pinned framework (`pinned-versions.json`)                                                                                                                                                                                                   |
| Maven groupId                    | `io.github.<owner>`                                                                                                                                                                                                                                        |
| Server port (`free-port`)        | `3000`, overridable at runtime with `PORT`; the JS/TS server defaults to the same port                                                                                                                                                                     |
| Log directory (`logger-winston`) | `logs/`                                                                                                                                                                                                                                                    |
| Initial git branch               | `main`                                                                                                                                                                                                                                                     |

## Enhancement layers

Applied at scaffold time only. Skeletor is a one-shot generator: it writes a project once and leaves nothing of its own behind to track or manage afterward.

- **Baseline layers** are applied to every scaffold of the templates they fit (`baselineLayers` in `template.json`): `governance`, `dependabot` and `issue-templates` everywhere, plus `quality-gates` and `docs-lint` on javascript and typescript.
- **Feature layers** are opt-in, via `--with` or a `--bundle` (see [Commands and flags](#commands-and-flags) above). Bundles list feature layers only. Interactive runs without either flag offer a picker of the feature layers that fit the template.

| Layer                       | Applies to             | Baseline | What it adds                                                                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dependabot`                | all                    | yes      | Grouped, monthly, single-PR Dependabot updates for the template's ecosystem + github-actions                                                                                                                                                                                                       |
| `docs-lint`                 | javascript, typescript | yes      | Pinned docs-lint CI: lychee 0.24.2 link/anchor checking + markdownlint-cli2                                                                                                                                                                                                                        |
| `docs-policy`               | all                    |          | Locks Markdown files to an exact allowlist seeded from what the scaffold emits, enforced by a docs-policy CI job                                                                                                                                                                                   |
| `env-example`               | javascript, typescript |          | Ships a .env.example listing the variables the config reads; npm start loads .env when it exists                                                                                                                                                                                                   |
| `express-server`            | javascript             |          | Replaces src/index.js with a minimal Express server: an app with a /health route, listening on PORT (default 3000), and a test for the route                                                                                                                                                       |
| `free-port`                 | javascript, typescript |          | Zero-dependency cross-platform port freeing script with a prestart hook                                                                                                                                                                                                                            |
| `governance`                | all                    | yes      | Appends agent governance protocols (issue workflow, test-before-handoff) to AGENTS.md                                                                                                                                                                                                              |
| `issue-labels`              | all                    |          | Opt-in label conventions for repos with CI/release process: a chore label, the area: prefix rule, and criteria for gate labels                                                                                                                                                                     |
| `issue-templates`           | all                    | yes      | Minimal repo-agnostic issue templates: bug report, feature request, epic form (native sub-issues), and blank issues disabled                                                                                                                                                                       |
| `library-publishing`        | typescript             |          | Turns a TS template into a publishable dual ESM/CJS npm package: a library entry (src/lib/index.ts) built by tsup into lib/, an exports map checked by attw in CI, a prepack build and prepublishOnly gate, MIT as the default license, and an OIDC publish workflow that runs the CI checks first |
| `log-table`                 | javascript, typescript |          | cli-table3 + string-width log table utility with display-width truncation and config defaults                                                                                                                                                                                                      |
| `logger-winston`            | javascript, typescript |          | Replaces the console logger stub with Winston (levels, file transports, env-aware default level)                                                                                                                                                                                                   |
| `quality-gates`             | javascript, typescript | yes      | Adds audit:ci (prod-only high/critical), lint:encoding (UTF-8/BOM/CRLF guard), and git:pull                                                                                                                                                                                                        |
| `test-harness:mongo-memory` | javascript, typescript |          | mongodb-memory-server start/stop helpers for Jest, an example test that uses them, and a test:mongo script                                                                                                                                                                                         |
| `test-harness:playwright`   | javascript, typescript |          | Minimal Playwright setup: a config with one Chromium project, an example spec, and test:e2e scripts; CI runs the specs                                                                                                                                                                             |
| `zod-config`                | javascript, typescript |          | Zod-validated env.config + config/index pattern; never read process.env in feature code                                                                                                                                                                                                            |

`skeletor new --github` also creates the labels that the chosen layers expect (for example `epic`), right after it creates the repo.

### Bundles

A bundle is a named set of feature layers for one template, defined in [bundles.json](./bundles.json). `--bundle` picks the template too, so `--template` is optional with it; if you pass both, they must match.

| Bundle        | Template   | Feature layers                                                               |
| ------------- | ---------- | ---------------------------------------------------------------------------- |
| `node-cli`    | javascript | `zod-config`, `logger-winston`, `env-example`, `log-table`                   |
| `express-api` | javascript | `zod-config`, `logger-winston`, `env-example`, `free-port`, `express-server` |
| `cli-report`  | javascript | `log-table`                                                                  |
| `ts-library`  | typescript | `library-publishing`                                                         |
| `ts-native`   | typescript | `test-harness:playwright`                                                    |

## Rich interactive CLI

`@clack/prompts` drives template selection, owner detection (git remote → package.json → gh CLI), the few remaining choices, and confirmations.

## Philosophy

- Developers **pick** language + flavor.
- JS/TS templates are opinionated; other stacks start from solid defaults.
- Add templates under `templates/<id>/` — auto-discovered by CLI and tests.
- Dependency manifests in templates use `.tmpl` suffix (see root `AGENTS.md`).

## Development

```bash
npm ci
npm test                  # fast — generation + contract checks
npm run test:verify       # full — runs each template's verifyCommands (needs toolchains)
npm run lint:encoding
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Links

- npm: [@jml6m/skeletor](https://www.npmjs.com/package/@jml6m/skeletor)
- GitHub: [jml6m/skeletor](https://github.com/jml6m/skeletor)

Feedback welcome via GitHub issues.
