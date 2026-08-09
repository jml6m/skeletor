# {{PROJECT_NAME}} — Agent Guidelines

> This file is the single source of truth for AI agent behavior in this repository.
> Update it as project conventions evolve.

## Build & Test

Run the project's tests before submitting changes and keep the test suite green.

## GitHub repo setup

Branch ruleset, merge-button config, and tag protection are GitHub.com settings —
skeletor doesn't touch them. See [docs/GITHUB-SETUP.md](./docs/GITHUB-SETUP.md)
for a one-time checklist to run after your first push.

## Critical Protocols

### Three-Strike Rule (Loop Prevention)

If the same error persists after **3 attempts**:

- **STOP** — do not keep retrying the same approach.
- Revert to the last known-good state.
- Document what was tried and surface the blocker.

### Commit & Push Safety

- Agents **propose** changes; humans or CI **push**.
- `git push` and publish commands are **prohibited** for agents.
- Never commit secrets, tokens, API keys, or credentials.

### GitHub Credentials — Never Commit Values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never by numeric ID. Workflows may reference secret *names* only
(e.g. `${{ secrets.APP_ID }}`).
