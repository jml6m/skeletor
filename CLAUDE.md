# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Start here

The authoritative agent guidelines for this repo live in **[AGENTS.md](./AGENTS.md)** — read it first and follow it. It is the source of truth for the project's purpose, the template/manifest contract, the CLI contract, and the **mandatory commit/push protocol** (pushing is never automatic — you must run the git steps explicitly). This file does not duplicate it.

Task-specific protocols live in **[.grok/rules/](./.grok/rules/)** and apply to Claude too:

- `issue-workflow.md` — GitHub issues are the planning source of truth.
- `fast-iteration.md` — use short-lived probe scripts to learn fast, then promote or delete.
- `testing.md` — what to test (the template manifest contract + generation).
- `session-validation.md` — the mandatory end-of-task validation gate.

## Repo quick facts

- `@jml6m/skeletor` — ESM Node CLI (`"type": "module"`, `bin: skeletor`), published to npm (scoped, public).
- Primary command: `node src/index.js new <name> [--template <id>] [--yes]`. `--yes` must stay fully non-interactive.
- Templates live in `templates/<id>/`; dependency-declaring files use a `.tmpl` suffix (see AGENTS.md).

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Jest suite — discovers templates, validates the manifest contract + generation. Run after every change. |
| `npm run lint` | Encoding gate + critical/high audit gate. |
| `npm run lint:encoding` | Fails on non-UTF-8 / BOM / CRLF / control chars in tracked files. |
| `npm run audit:ci` | Fails only on critical/high advisories (moderate/low ignored). |
| `npm run format` | Prettier write. |
| `npm run npm:reinstall` | Clean reinstall, then the audit gate. |
| `npm run git:pull` | Full `fetch --all --prune` + fast-forward pull. |
| `npm run release:patch\|minor\|major\|alpha` | Bump version + push tag → triggers the publish workflow. |

## Conventions

Follow the author's standing coding conventions: comments only where they earn their place (no changelog-style "updated/refactored" comments); targeted edits over full-file rewrites; never use `alert()` in frontend JS; check for existing SCSS variables before hardcoding. Include a one-line `git commit -m "..."` when delivering a changeset.

## Before handing work back

Run `npm test` and `npm run lint`; report pass/fail explicitly per `.grok/rules/session-validation.md`. Do not claim a check passed unless it actually ran.
