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
- Primary command: `node src/index.js new <name> --template <id> [--auto]`. `--auto` must stay fully non-interactive and requires `--template`. Owner is auto-detected or passed via `--owner`; description is optional via `--description`.
- Templates live in `templates/<id>/`; dependency-declaring files use a `.tmpl` suffix (see AGENTS.md).

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Jest suite — discovers templates, validates the manifest contract + generation. Run after every change. |
| `npm run lint` | Encoding gate (runs `lint:encoding`). |
| `npm run lint:encoding` | Fails on non-UTF-8 / BOM / CRLF / control chars in tracked files. |
| `npm run audit:ci` | Hard-fails on critical/high in **production** deps (dev-only + moderate/low reported, not gated). Separate from `lint`; also run by `npm:reinstall` and CI. |
| `npm run npm:reinstall` | Clean reinstall, then the audit gate. |
| `npm run git:pull` | Full `fetch --all --prune` + fast-forward pull. |
| `npm run release:patch\|minor\|major\|alpha` | Bump version + push tag → triggers the publish workflow. |
| `npm run release:preflight` | Tag/version + not-already-published checks before tagging. |

Tag-driven CI publish requires **npm Trusted Publishing** — see [docs/RELEASE.md](./docs/RELEASE.md).

## Conventions

Follow the author's standing coding conventions: comments only where they earn their place (no changelog-style "updated/refactored" comments); targeted edits over full-file rewrites; never use `alert()` in frontend JS; check for existing SCSS variables before hardcoding. For commit/push, follow AGENTS.md's protocol — do not commit or push unless it directs you to.

## Before handing work back

Run `npm test`, `npm run lint`, and `npm run audit:ci`; report pass/fail explicitly per `.grok/rules/session-validation.md`. Do not claim a check passed unless it actually ran.
