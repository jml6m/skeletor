# Skeletor
Efficient scaffolding for custom development.

Generates empty (or lightly stubbed) projects pre-configured with **your** rules and recommendations, derived from analysis of many GitHub-linked workspaces (local-land-client/server, cuda-sandbox, x-app-skeleton, etc.).

## Available Templates

Skeletor lets you **pick** the kind of project you want. Run `skeletor new my-project` (omit `--template`) for an interactive selector, or pass `--template <id>`.

Current templates (standard main libraries + your flavors where they existed):

- `javascript` — Your exact CJS conventions (Prettier 165, ESLint+unused-imports, aliases, health tools, release gates, AGENTS.md, husky+lint-staged, etc.)
- `typescript` — Modern ESM + flat ESLint + TypeScript, tsconfig, build, your quality gates + AGENTS.md
- `python` — Best-practice defaults (pyproject.toml + ruff for lint+format, pytest, mypy, src layout)
- `go` — Standard Go module (`go.mod` + main + tests)
- `rust` — Standard Cargo binary crate
- `java` — Maven + JUnit 5 structure
- `csharp` — .NET 8 console + xUnit

Each template includes a `template.json` manifest that declares `verifyCommands` — the exact steps (3 & 4) a developer should run after scaffolding. The test suite discovers templates and validates this contract.

> New languages/stacks: Drop a directory under `templates/<id>/` with a `template.json` + conventional source/build/test files using `{{PROJECT_NAME}}` etc. tokens. The CLI, listing, and tests pick it up automatically.

## Rich Interactive CLI

We use `@clack/prompts` for a modern experience:
- Beautiful template selector with descriptions/hints when you omit `--template`
- **Select-first** prompts with `(recommended)` labels (owner, layers, confirmations)
- GitHub owner auto-detection (git remote → package.json → gh CLI) with select or custom entry
- Confirmation step; proper cancel handling and nice spinners/intro/outro

`--auto` stays fully non-interactive for scripts (requires `--template`). Pass `--owner` when detection cannot run; `--description` is optional on the CLI.

## Pushing to GitHub

**Pushing is not automatic.** After every set of changes (new templates, CLI updates, tests, docs), you **must** explicitly:
1. `git add -A`
2. `git commit -m "..."` (good message)
3. `git push -u origin HEAD`

See the root `AGENTS.md` for the standing instruction given to agents working on this repo. This ensures the GitHub repo (`https://github.com/jml6m/skeletor`) stays in sync with every request. There is no special Grok Build setting that auto-pushes; it must be done via explicit git commands in the agent loop (or documented in project instructions like AGENTS.md).

## Usage (alpha)

```bash
# Interactive (recommended for exploration)
node src/index.js new my-project

# Or specify
node src/index.js new my-api --template typescript

# Recommended enhancements (v0.2+)
npx @jml6m/skeletor new my-api --template typescript --with-recommended

# Non-interactive (scripts) — pass --owner when detection cannot run
npx @jml6m/skeletor new my-service --auto --template go --owner acme-corp
```

Common flags:
- `--template <id>` (javascript, typescript, python, go, rust, java, csharp, ...)
- `--with-recommended` / `--with <layers>` / `--bundle <name>` (enhancement layers)
- `--owner <user>` skips auto-detection (git remote → package.json → gh CLI)
- `--description <text>` optional; a generic default is used when omitted
- `--auto` (non-interactive; requires `--template`; requires `--owner` if owner cannot be detected)
- `--no-git` (skip git init; git is on by default)

Interactive prompts use **select lists** with a `(recommended)` label. `enhance` refuses dirty git trees unless `--allow-dirty`.

After scaffolding, follow the `verifyCommands` from that template's `template.json` (shown in the success message). E.g. for most JS/TS: `npm install && npm run health:full` etc.

Run `skeletor` (or `node src/index.js`) with no args to see current templates.

## Philosophy / Goals

- Developers **pick** the scaffolding they want (language + flavor).
- Your personal conventions (from the workspaces analysis) are encoded in the relevant templates (javascript/typescript for now).
- Everything else starts from clean "standard main library" best practices and can be refined later.
- The `template.json` manifest per template is the contract for post-generation steps (this is what the test suite validates as steps 3 & 4).
- Easy to evolve: add/edit under `templates/<id>/`. New templates are auto-discovered by the CLI and tests.

## Status

Active. Multiple language templates + rich clack-based interactive UI. Test suite validates generation + manifest contracts for every template.

Run `skeletor` (or `node src/index.js`) with no args for current help and template list.

## Releasing

CI publish uses npm **Trusted Publishing** (OIDC). Configure it once on npmjs.com, then push a `v*` tag. See **[docs/RELEASE.md](./docs/RELEASE.md)** for the exact fields, re-run steps, and manual fallback.

## For Testers & Reviewers

### Quick try (no install needed)

```bash
# From a clone of this repo
node src/index.js new my-test-project --auto --template javascript

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

### Updating / Adding Templates

The source of truth lives in `templates/<id>/` (each with its own `template.json`).

- Edit files inside an existing template → next generation gets the change.
- Add a whole new `templates/newlang/` with `template.json` + files → it appears in the picker, help, and tests automatically.
- **Ecosystem manifest files** (e.g. `package.json`, `pyproject.toml`, `Cargo.toml`, `pom.xml`, `*.csproj`, `go.mod`) must be named with a `.tmpl` suffix inside the template (e.g. `package.json.tmpl`). The generator strips the suffix on output, so the generated project sees the conventional filename. This prevents GitHub's dependency graph from treating template dependencies as skeletor's own.

Always run `npm test` after template work.

When happy, commit + push (see root `AGENTS.md` for the standing rule).

### GitHub push & external review

Pushing is **explicit** (not automatic). After changes:
- Run tests
- `git add -A && git commit -m "..." && git push -u origin HEAD`

See the root `AGENTS.md` (the instruction file for agents) for the exact rule.

The repo lives at https://github.com/jml6m/skeletor.

Open issues/PRs with feedback on new templates, UI, etc.

Now, finish the UI polish if needed and do the push.