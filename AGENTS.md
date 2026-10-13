# Skeletor — agent guidance

**Project:** skeletor
**Purpose:** Multi-language project scaffolding CLI. Users pick a template (javascript, typescript, python, go, rust, java, csharp, ...) to generate a new project pre-configured with good defaults and, where applicable, opinionated conventions.

Project-facing guidance for coding agents and reviewers. Contribution flow is in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Core Rules

- **Templates live in `templates/<id>/`**
  - Every template **must** have a `template.json` manifest with at least: `id`, `name`, `description`, `language`, `verifyCommands` (array of commands a developer runs after scaffolding, e.g. `["npm install", "npm test"]` or `["cargo test"]`).
  - Every template **must** have a `pinned-versions.json` beside `template.json`. This is the source of truth for runtime and dependency pins (`status`: `active` | `needs-review` | `deprecated`). Template `.tmpl` files reference `{{PIN_*}}` tokens generated from this manifest. Bump pins deliberately after validation; set `needs-review` or `deprecated` when upstream majors land before the template is patched.
  - GitHub Actions in emitted workflows (templates and layers) are SHA-pinned from one list, [templates/_shared/github-actions.json](./templates/_shared/github-actions.json): write `uses: {{PIN_ACTION_<REPO>}}` (e.g. `{{PIN_ACTION_SETUP_NODE}}`), never a tag or branch. It holds the same SHAs as skeletor's own workflows; a test fails when they drift.
  - Use the standard tokens in file *contents*: `{{PROJECT_NAME}}`, `{{REPO_OWNER}}`, `{{REPO_NAME}}`, `{{DESCRIPTION}}`, `{{YEAR}}`.
  - `{{DESCRIPTION}}` is collapsed to one line and escaped only in `.json`, `.toml` and XML (`.xml`, `.csproj`, `.props`, `.targets`) files ([src/escape.js](./src/escape.js)); put it inside a `"..."` string in `.json` and `.toml`. Elsewhere it goes in raw: use it in README and AGENTS.md text, not in source-file comments or docstrings (use `{{PROJECT_NAME}}` there). Project names (lowercase kebab-case) and owners are validated up front ([src/validate-input.js](./src/validate-input.js)), so they need no escaping. C# templates use `{{CSHARP_NAMESPACE}}`, the name in PascalCase.
  - **Any file that contains real ecosystem dependency declarations** (e.g. `package.json`, `pyproject.toml`, `Cargo.toml`, `pom.xml`, `*.csproj`, `go.mod`) **must use a `.tmpl` suffix** in the template directory (e.g. `package.json.tmpl`). The generator strips the suffix on output so the generated project has the conventional filename. This keeps skeletor's own dependency graph clean.
  - File and directory names are rendered too, so a path segment can carry a token (java's `src/main/java/{{JAVA_PACKAGE_PATH}}/`, csharp's `src/{{CSHARP_NAMESPACE}}/{{CSHARP_NAMESPACE}}.csproj.tmpl`). Use a token only where the ecosystem names files after the project; keep fixed names elsewhere.
  - **The generated `.gitignore` has one source**: the template's `features` in `template.json`, built from `FEATURE_REGISTRY` in [src/features.js](./src/features.js) (plus each applied layer's `gitignore` entries). Every template declares `features`, and no template ships a `.gitignore` or `.gitignore.tmpl`. When a template gains a tool, add its output paths to that tool's feature.
  - Include at minimum: README.md + AGENTS.md (light version) + one main source file + one test file + appropriate build config (go.mod, Cargo.toml, pom.xml, .csproj, etc.).

- **When adding or modifying templates**
  - Start with "standard main library" best practices for the language/ecosystem.
  - The test suite in `tests/generate.test.js` automatically discovers new templates via `getTemplatesWithManifests()` and exercises generation + asserts the manifest contract (verifyCommands).
  - After changes, **always run `npm test`** to validate.

- **Layout-specific output.** A template with `layouts` (rust, python) keeps each layout's files, including its `.github/` and `README.md`, under `layouts/<id>/`. A layout can override `verifyCommands`.

- **Layers live in `layers/<id>/`** (`layer.json` plus `files/`), are applied only at `skeletor new` time, and are recorded nowhere in the generated project.
  - A layer applied to both `javascript` (CommonJS) and `typescript` (ESM) must emit a correct module format for each. Ship `.js` (CommonJS) plus `.ts` twins, since the twin for the other language is dropped. Use `.cjs` for one script that must run in both.
  - `patch.packageJson` is one file, or a `{ "javascript": …, "typescript": … }` map when dependencies differ (for example, `string-width` v4 is the last CommonJS major).
  - `patch.packageJson` merges keep a key the template already has; `patch.packageJsonOverride` lists top-level keys the layer replaces instead (`null` removes one, e.g. `private`).
  - The package.json merge keeps scripts the template already defines; `patch.replaceScripts` names the ones the layer's patch replaces (env-example's `start`).
  - `requires` lists layers this one can't work without; they are applied automatically. There is no soft dependency: a layer is self-contained or declares `requires`.
  - `defaults` changes the default of a scaffold prompt by token (library-publishing: `LICENSE` → `MIT`); an explicit answer still wins.
  - `knip.entry` registers the layer's public API or harness files as knip entry points. `labels` declares GitHub labels that `--github` creates. `gitignore` lists the output paths the layer's tools create (reports, build output); they are appended to the generated `.gitignore` and may use `{{TOKEN}}` values.
  - Every optional layer and bundle is generated and verified in CI (`tests/generate.test.js`, "optional layers and bundles"): the template's and layer's `verifyCommands`, with `npm run lint -- --max-warnings 0` and `npx knip --treat-config-hints-as-errors`.

- **CLI / src/index.js**
  - Use `@clack/prompts` for rich interactive experience (select with hints, text, confirm, intro/outro, cancel handling).
  - `new <name>` is the primary command.
  - When no `--template` and interactive (TTY + no `--auto`): show nice clack select.
  - `--auto` must remain fully non-interactive for scripting; it requires `--template` (or a `--bundle`, which names its template).
  - `--owner` skips auto-detection (git remote → package.json → gh CLI); required in `--auto` when detection fails. No hardcoded default owner.
  - `--description` is optional (defaults to a generic string); no interactive description prompt.
  - Interactive prompts use select lists with `(recommended)` labels where applicable.
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
