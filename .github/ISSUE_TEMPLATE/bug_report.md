---
name: Bug report
about: Report a defect in the skeletor CLI, a template, a layer, or a generated project
title: '[BUG] '
labels: bug
assignees: ''
---

<!--
  Describe the problem on its own terms: what skeletor did and what it should have done.
  Reproduce it with a neutral project name (my-app) so anyone can run the same command.
-->

**Overview**
A clear and concise description of the failure.

**Command run**

```bash
# The exact command that triggered the bug, with a neutral project name
npx @jml6m/skeletor new my-app --auto --template typescript --no-git
```

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Error / log output**

```text
Paste the relevant stdout / stderr here.
```

**Reproduction steps** (if the command alone doesn't show it)

1. ...
2. ...

**Environment**

- **skeletor version:** (e.g., 0.7.0, from `npx @jml6m/skeletor --version`)
- **Node version:** (e.g., v24.10.0, from `node --version`; skeletor needs Node 22 or later)
- **OS:** (e.g., Windows 11, macOS 15, Ubuntu 24.04)
- **Shell:** (e.g., PowerShell 7, bash, zsh)

**Where does the bug occur?**

- [ ] CLI (`skeletor new`, `--help`, argument parsing, interactive prompts)
- [ ] Generator (file copy, `{{TOKEN}}` rendering, `.tmpl` suffix stripping)
- [ ] A specific template — which one? <!-- e.g. javascript, typescript, python -->
- [ ] A layer or bundle — which one? <!-- e.g. zod-config, ts-library -->
- [ ] A generated project's `verifyCommands` (install / lint / test / health / build)
- [ ] Docs (README.md, AGENTS.md, a generated project's docs)

**Test context (if applicable)**
_If a skeletor test caught it:_ the failing suite (e.g., `tests/generate.test.js`), the command
(`npm test`), and its output.

**Additional context**
<!-- e.g. tree of the generated project, diff between expected and actual file contents -->
