# Skeletor — agent guidance

**Project:** skeletor
**Purpose:** Multi-language project scaffolding CLI. Users pick a template (javascript, typescript, python, go, rust, java, csharp, ...) to generate a new project pre-configured with good defaults and, where applicable, opinionated conventions.

Project-facing guidance for coding agents and reviewers. Contribution flow is in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Core Rules

- **Templates live in `templates/<id>/`**
  - Every template **must** have a `template.json` manifest with at least: `id`, `name`, `description`, `language`, `verifyCommands` (array of commands a developer runs after scaffolding, e.g. `["npm install", "npm test"]` or `["cargo test"]`).
  - Every template **must** have a `pinned-versions.json` beside `template.json`. This is the source of truth for runtime and dependency pins (`status`: `active` | `needs-review` | `deprecated`). Template `.tmpl` files reference `{{PIN_*}}` tokens generated from this manifest. Bump pins deliberately after validation; set `needs-review` or `deprecated` when upstream majors land before the template is patched.
  - Use the standard tokens in file *contents*: `{{PROJECT_NAME}}`, `{{REPO_OWNER}}`, `{{REPO_NAME}}`, `{{DESCRIPTION}}`, `{{YEAR}}`.
  - **Any file that contains real ecosystem dependency declarations** (e.g. `package.json`, `pyproject.toml`, `Cargo.toml`, `pom.xml`, `*.csproj`, `go.mod`) **must use a `.tmpl` suffix** in the template directory (e.g. `package.json.tmpl`). The generator strips the suffix on output so the generated project has the conventional filename. This keeps skeletor's own dependency graph clean.
  - Filenames are **not** auto-rendered (current limitation). Use conventional fixed names inside the template (user can rename after generation).
  - Include at minimum: README.md + AGENTS.md (light version) + one main source file + one test file + appropriate build config (go.mod, Cargo.toml, pom.xml, .csproj, etc.).

- **When adding or modifying templates**
  - Start with "standard main library" best practices for the language/ecosystem.
  - The test suite in `tests/generate.test.js` automatically discovers new templates via `getTemplatesWithManifests()` and exercises generation + asserts the manifest contract (verifyCommands).
  - After changes, **always run `npm test`** to validate.

- **Layout-specific output.** A template with `layouts` (rust, python) keeps each layout's files, including its `.github/` and `README.md`, under `layouts/<id>/`. A layout can override `verifyCommands`.

- **Layers live in `layers/<id>/`** (`layer.json` plus `files/`), are applied only at `skeletor new` time, and are recorded nowhere in the generated project.
  - A layer applied to both `javascript` (CommonJS) and `typescript` (ESM) must emit a correct module format for each. Ship `.js` (CommonJS) plus `.ts` twins, since the twin for the other language is dropped. Use `.cjs` for one script that must run in both.
  - `patch.packageJson` is one file, or a `{ "javascript": …, "typescript": … }` map when dependencies differ (for example, `string-width` v4 is the last CommonJS major).
  - `knip.entry` registers the layer's public API or harness files as knip entry points. `labels` declares GitHub labels that `--github` creates.
  - Every optional layer and bundle is generated and verified in CI (`tests/generate.test.js`, "optional layers and bundles"), including a strict `npx knip`.

- **CLI / src/index.js**
  - Use `@clack/prompts` for rich interactive experience (select with hints, text, confirm, intro/outro, cancel handling).
  - `new <name>` is the primary command.
  - When no `--template` and interactive (TTY + no `--auto`): show nice clack select.
  - `--auto` must remain fully non-interactive for scripting; it requires `--template` (or a `--bundle`, which names its template).
  - `--owner` skips auto-detection (git remote → package.json → gh CLI); required in `--auto` when detection fails. No hardcoded default owner.
  - `--description` is optional (defaults to a generic string); no interactive description prompt.
  - Interactive prompts use select lists with `(recommended)` labels where applicable.
  - Template `.gitignore` files must be named `.gitignore.tmpl` so npm publish includes them (npm strips bare `.gitignore` from packages).
  - Keep the generator itself (copyAndRender + render) dependency-free and simple.

- **Don't commit** test artifacts (`gen-*` directories from previous runs) or `node_modules`.

- **Testing the full flow**
  - `node src/index.js new my-test --template <id>` (or omit for interactive).
  - `cd my-test`
  - Run the commands listed in that template's `verifyCommands`.
  - The integration tests do a programmatic version of generation + contract validation.

## Adding a brand new language/stack later
Start from clean "standard library + modern defaults" (as done for go/rust/java/csharp); the maintainer decides a stack's specific conventions.

Update this file when the development process or conventions for skeletor itself change.

## Documentation conventions

- **Linkable paths must be clickable links** (e.g. `[src/index.js](./src/index.js)`). Command examples and illustrative paths are exempt.
- [`docs-lint`](./.github/workflows/docs-lint.yml) checks links and `#anchors` (lychee) and formatting (markdownlint-cli2, per [`.markdownlint-cli2.yaml`](./.markdownlint-cli2.yaml)). Emitted `templates/` and `layers/` fixtures are excluded; the verify-templates job covers them. Run `markdownlint-cli2 --fix '**/*.md'` before pushing.
- **Markdown files are limited to an allowlist**, [`.github/docs-policy.yml`](./.github/docs-policy.yml) (plus `templates/**` and `layers/**`, exempt as emitted fixtures), enforced by the `docs-policy` check. Don't add a new top-level `.md` file; put design notes in the PR or an issue.
