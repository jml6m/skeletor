# Contributing to skeletor

skeletor is maintained by one person. Issues and pull requests are welcome; response times are
best-effort.

## What's wanted

- Bug reports with the exact `skeletor new` command, the template and layers, and what failed.
- Fixes to templates, layers and the CLI, with a test.
- New templates or layers: open an issue first, so the conventions are agreed before code.

## Before you open a PR

Open an issue first for anything beyond a typo. Use the templates under
[`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/).

## Local gates

```bash
npm ci
npm test               # generation + manifest contract checks
npm run test:verify    # full: runs each template's verifyCommands (needs the toolchains)
npm run lint:encoding
```

CI runs the same across Node versions, plus a Markdown link and format check.

## PR conventions

- Open the PR against `main`. Its description has a line starting with `Relates to #N` for the
  issue it serves.
- Keep a PR to one change. PRs are squash-merged.
- Don't bump the version in `package.json`.

## Where the rules live

[AGENTS.md](./AGENTS.md) has the template, layer and CLI rules.
