# 🤖 Agent & AI Protocols (All Agents)

**Project:** {{PROJECT_NAME}} <br />
**Runtime:** Node.js (>=20.19.0) <br />
**Testing:** Jest

> **📌 Single Source of Truth**: This document is the authoritative reference for all coding standards, architecture rules, and project policies in this repository. If there is a conflict between this document and any other file, `AGENTS.md` takes precedence.

This document defines the operational parameters, architectural standards, and safety protocols for all AI agents working within this repository.

---

## 🛑 Critical Protocols (Read First)

### 1. The "Three Strike" Rule (Loop Prevention)

For unsupervised runs (e.g. automated fixes or refactors):
- If you attempt to fix an error and the **same** error persists after **3 attempts**:
  - **STOP**.
  - Revert to the last functioning state.
  - Mark the test/code with `// FIXME: Agent worker failed` or `.skip`.
  - Log the failure and move on.

### 2. Versioning & Release Policy

- **One PR = One Bump**: Version bump happens **once** using `npm run release:patch` when creating the PR.
- `npm run release:minor` only for substantial new features (coordinate with admin).
- ⛔ `npm run release:major` is **human-only**.

### 3. Command Execution Safety

**STRICTLY PROHIBITED for agents:**
- `npm publish`
- `git push` (agents propose; humans / CI push)
- Running migrations or prod start commands without explicit request
- Direct edits to core bootstrap / auth / secret-handling files (see Exclusions below)

### 4. Code Review & PR Interaction

- The agent **MUST** respond to comments from the primary (human) reviewer or when explicitly @-tagged.
- **No passive "Acknowledged" / "Will fix"**. Either make the change or discuss with technical reasoning.
- Human reviewer comments always take priority over bot threads.

### 5. Cross-Repo Coordination (when applicable)

When work spans multiple repositories, create paired issues and cross-link PRs in both Coordination sections.

---

## 📐 Architecture & Coding Standards

- **Module aliases over relatives**: Never use `../`. Use `@src`, `@utils`, `@config`, `@services`, etc. (enforced by ESLint + jsconfig).
- **Configuration SSoT**: Never read `process.env` directly in feature code. Centralize in `@config`.
- **Layered architecture** (recommended): Routes/Controllers (thin) → Services (business logic) → Models/Mechanics (pure functions).
- **Zod where helpful**: Use for config validation and request/input schemas.
- **Logging**: Use a structured logger (Winston or equivalent). Static message strings + metadata object. Never `console.log` in production paths.
- **Error handling**: Use explicit `AppError` / error classes with constants for consistent responses.

See `docs/CODING_STANDARDS.md` (if present) for expanded examples.

### Code Style (enforced)

- Prettier (see `.prettierrc.json`): 2 spaces, single quotes, semicolons, printWidth 165, organize-imports.
- File names: `kebab-case.js` or `kebab-case.test.js`.
- Functions: `camelCase`, classes `PascalCase`, constants `SCREAMING_SNAKE_CASE`.

### ESLint highlights (see .eslintrc.json)

- `unused-imports/no-unused-imports`: error
- `no-restricted-imports`: `../*` forbidden
- `no-restricted-properties`: `process.env` and `process.exit` (with documented exceptions)
- `no-console`: warn (scripts/tests/config overrides allowed)

---

## 🛡️ Logging & Error Handling (summary)

- Import the shared logger.
- Messages are **static strings**; data goes in the 2nd (metadata) argument.
- For errors: always log `{ error: err.message, stack: err.stack }`.
- See the full patterns in active reference projects (local-land-server etc.).

---

## 🧪 Testing

- Unit tests: heavily mock external deps (DB, network, time).
- Integration: use in-memory or test harnesses where available.
- Follow AAA. Keep tests readable and deterministic.
- Run `npm run health:full` before opening PRs.

---

## 🛑 Excluded Source Code (for AI context size & security)

The following are intentionally **not** provided in full to agents by default. Ask for snippets if you need to propose changes.

- `src/index.js` (or main entry / bootstrap)
- Authentication / token / JWT utilities
- Any file that would require hard-coding real secrets

**Never** output real secrets, tokens, keys, GitHub App IDs, PATs, or Actions secret values. Use config + env. Do not commit App IDs or credential values into source, docs, or agent instruction files.

---

## Additional Resources

- Your personal conventions are derived from analysis of multiple active GitHub-linked workspaces.
- Update this file when the project's architecture or policies evolve.
- `npm run prompt:gen` (or with `--all`) can be used to produce a full context dump for complex tasks.

### GitHub credentials — never commit values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never numeric ID. Workflows may use secret *names* only
(e.g. `${{ secrets.APP_ID }}`).

