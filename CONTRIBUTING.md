# Contributing to skeletor

skeletor is maintained by one person. Issues and pull requests are welcome; response times are
best-effort.

## What's wanted

- Bug reports with the exact `skeletor new` command, the template and layers, and what failed
  (see [Writing a good issue](#writing-a-good-issue)).
- Fixes to templates, layers and the CLI, with a test.
- New templates or layers: open an issue first, so the conventions are agreed before code.

## Before you open a PR

Open an issue first for anything beyond a typo. Use the templates under
[`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/).

## Writing a good issue

- Describe the change or the problem on its own terms: what skeletor does, what it should do,
  and why. Leave out the project you were building unless it is the reproduction.
- Give a reproduction with a neutral project name, for example
  `npx @jml6m/skeletor new my-app --auto --template typescript --no-git`, plus any steps after it.
- Say what you expected and what happened instead, with the error output.
- Include the skeletor version (`npx @jml6m/skeletor --version`) and the Node version
  (`node --version`).

## Local gates

```bash
npm ci
npm test               # generation + manifest contract checks
npm run test:verify    # full: runs each template's verifyCommands (needs the toolchains)
SKELETOR_VERIFY_SHARD=go npm run test:verify   # one shard: a template id, or <javascript|typescript>-<layers|bundles>
npm run lint:encoding
npm run lint:agents    # AGENTS.md and CLAUDE.md length cap
npm run lint:docs      # markdownlint
npm run audit:ci       # dependency security audit (mirrors the Audit CI workflow)
```

CI runs `npm run lint:encoding` and `npm test` on Node 22 and 24, and the template verify suite
(`npm run test:verify`, sharded by the templates a change touches) on Node 24 only. It also runs a
dependency security audit and the docs checks: links, Markdown format, the AGENTS.md and CLAUDE.md
length cap, and the Markdown allowlist.

In a clone, `npm ci` enables a pre-push hook ([`.husky/pre-push`](./.husky/pre-push)) that
runs `npm run lint` and `npm test`. `git push --no-verify` skips it; that's a deliberate choice, and
CI still runs everything.

## PR conventions

- Open the PR against `main`. Its description has a line starting with `Relates to #N` for the
  issue it serves.
- Keep a PR to one change. PRs are squash-merged.
- Don't bump the version in `package.json`.

## Where the rules live

[AGENTS.md](./AGENTS.md) has the template, layer and CLI rules.
