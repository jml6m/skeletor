# 🤖 Skeletor Development — Agent Guidelines

**Project:** skeletor
**Purpose:** Multi-language project scaffolding CLI. Users pick a template (javascript, typescript, python, go, rust, java, csharp, ...) to generate a new project pre-configured with good defaults + (where applicable) personal conventions.

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

- **CLI / src/index.js**
  - Use `@clack/prompts` for rich interactive experience (select with hints, text, confirm, intro/outro, cancel handling).
  - `new <name>` is the primary command.
  - When no `--template` and interactive (TTY + no `--auto`): show nice clack select.
  - `--auto` must remain fully non-interactive for scripting; it requires `--template`.
  - `--owner` skips auto-detection (git remote → package.json → gh CLI); required in `--auto` when detection fails. No hardcoded default owner.
  - `--description` is optional (defaults to a generic string); no interactive description prompt.
  - Interactive prompts use select lists with `(recommended)` labels where applicable.
  - Template `.gitignore` files must be named `.gitignore.tmpl` so npm publish includes them (npm strips bare `.gitignore` from packages).
  - Keep the generator itself (copyAndRender + render) dependency-free and simple.

- **After any implementation work (templates, CLI, tests, docs, etc.)**
  1. Run `npm test` and ensure it passes.
  2. Review changes with `git status` / `git diff`.
  3. `git add -A`
  4. `git commit -m "descriptive message (e.g. feat(templates): add go, rust, java, csharp + clack interactive UI)"`
  5. `git push -u origin HEAD`
  - Pushing is **not automatic**. You must explicitly perform the git commands every time.
  - This rule exists because the user wants the GitHub repo to stay in sync after every request.

- **Git / Worktrees**
  - This is often developed in a worktree. Normal `git push` still works against the shared remote.
  - Avoid committing test artifacts (gen-* directories from previous runs) or node_modules.

- **Testing the full flow**
  - `node src/index.js new my-test --template <id>` (or omit for interactive).
  - `cd my-test`
  - Run the commands listed in that template's `verifyCommands`.
  - The integration tests do a programmatic version of generation + contract validation.

## Adding a brand new language/stack later
The user will provide specific guidance/flavors. Until then, use clean "standard library + modern defaults" (as done for go/rust/java/csharp).

Update this file when the development process or conventions for skeletor itself change.

## Branch & ref hygiene

- **Auto-delete on merge** is enabled — merged PR branches are removed automatically; don't rely on them persisting.
- **Branch naming**: short-lived topic branches off `main`, prefixed by intent — `feat/`, `fix/`, `chore/`, `docs/`. Open a PR into `main`; **squash-merge** keeps `main` linear (the repo ruleset enforces no force-push / no deletion on `main`).
- **Tag/ref retention**: release tags `v*` are **permanent and immutable** — never delete or move a published tag (it backs the `@jml6m/skeletor` npm release); fix a mistake with a new `vX.Y.Z`. Non-release refs are disposable.
- **Periodic stale-branch sweep** (manual, report-only — never auto-delete beyond the merge cleanup):
  - List remote branches by last commit, newest last:
    `git for-each-ref --sort=committerdate --format='%(committerdate:short) %(refname:short)' refs/remotes/origin`
  - Cross-reference against open PRs (`gh pr list --state open`) and delete only stale, merged, PR-less branches deliberately.

## Documentation conventions

- **Linkable paths must be clickable links.** Any in-repo path mentioned in a Markdown file must be written as a clickable link to the target (e.g. `[src/index.js](./src/index.js)`), not as bare inline code. Command examples and illustrative / non-existent paths are exempt.
- Docs are gated by [`.github/workflows/docs-lint.yml`](./.github/workflows/docs-lint.yml): [lychee](https://lychee.cli.rs/) validates that links and `#anchors` resolve, and [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) enforces formatting per [`.markdownlint-cli2.yaml`](./.markdownlint-cli2.yaml). Emitted `templates/` and `layers/` fixtures are excluded (covered by the verify-templates job). Run `markdownlint-cli2 --fix '**/*.md'` before pushing.
