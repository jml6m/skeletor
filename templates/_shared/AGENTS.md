# {{PROJECT_NAME}} — Agent Guidelines

> This file is the single source of truth for AI agent behavior in this repository.
> Update it as project conventions evolve.

## Build & Test

Run these from the repo root before submitting changes, and keep them passing. The
[CI workflows](./.github/workflows/) run the checks on every pull request.

```bash
{{VERIFY_COMMANDS}}
```{{AGENTS_BUILD_AND_TEST}}

## Branch & ref hygiene

- Squash-merge PRs and let GitHub delete merged branches automatically.
- Release tags (`v*`) are permanent: fix a mistake with a new version.
- Stale-branch sweeps are manual and report-only. List branches with
  `git for-each-ref --sort=committerdate --format='%(committerdate:short) %(refname:short)' refs/remotes/origin`,
  compare against `gh pr list --state open`, and delete only stale, merged, PR-less branches, one at a time.

## Documentation conventions

- Write in-repo paths in Markdown as clickable links (`[README.md](./README.md)`), not bare code spans.
  Commands and illustrative paths are exempt.
- Docs describe the project as it is now. Don't keep per-release doc archives; history belongs in git and
  release notes.

## Critical Protocols

### Three-Strike Rule (Loop Prevention)

If the same error persists after **3 attempts**:

- **STOP** — do not keep retrying the same approach.
- Revert to the last known-good state.
- Document what was tried and surface the blocker.

### Branches and PRs

Work on short-lived branches off the default branch, prefixed by intent: `feat/`, `fix/`, `chore/`,
`docs/`. Commit, push the branch and open a pull request. The default branch changes only through
reviewed PRs with passing checks.

**Never**: push or force-push the default branch, delete a protected branch, skip a required check,
delete or move a published tag, or publish a package or release unless asked. Never commit secrets,
tokens, API keys or credentials.

### GitHub Credentials — Never Commit Values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never by numeric ID. Workflows may reference secret _names_ only
(e.g. `${{ secrets.APP_ID }}`).
