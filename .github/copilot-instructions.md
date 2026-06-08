# ðŸ¤– Skeletor Development â€” Agent Guidelines

> NOTE: This file intentionally mirrors the root `AGENTS.md`. Prefer updating `AGENTS.md` first, then copy/regenerate this file to keep them in sync.

**Project:** skeletor
**Purpose:** Multi-language project scaffolding CLI. Users pick a template (javascript, typescript, python, go, rust, java, csharp, ...) to generate a new project pre-configured with good defaults + (where applicable) personal conventions.

## Core Rules

- **Templates live in `templates/<id>/`**
  - Every template **must** have a `template.json` manifest with at least: `id`, `name`, `description`, `language`, `verifyCommands` (array of commands a developer runs after scaffolding, e.g. `["npm install", "npm test"]` or `["cargo test"]`).
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
  - When no `--template` and interactive (TTY + no `--yes`): show nice clack select.
  - `--yes` must remain fully non-interactive for scripting/CI.
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


# Agent Guidelines for GitHub Issues

When tasked with creating, editing, or managing GitHub Issues, you MUST follow these rules:

1. **USE THE CLI (gh)**: Do NOT use the Draft UI on GitHub.com to draft issues for manual creation. You must use the GitHub CLI (gh issue create, gh issue edit) directly. This immediately provides the true Issue ID/URL back to you in the terminal.
2. **EPIC WORKFLOW**:
   - Create the child/sub-issues FIRST using gh issue create.
   - Capture the newly generated Issue IDs (e.g., #45, #46).
   - Create the Parent Epic AFTER the children, and immediately inject those exact IDs into the Epic's Task List.
   - This entirely eliminates the manual loop of drafting, creating, and editing to fix broken links.
3. **RELATIONSHIPS**: 
   - Always use strict relationship keywords followed by the exact ID or URL: Blocked by #123, Depends on #123, Relates to #123. 
   - Never use plain text descriptions for relationships. Find the correct Issue ID first.
