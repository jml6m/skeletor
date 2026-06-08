---
name: Bug report
about: Report a defect in the skeletor CLI, a template, or a generated project
title: '[BUG] '
labels: bug
assignees: ''
---

**Overview**
A clear and concise description of the failure.

**Environment**

- **skeletor version:** (e.g., 0.1.0-alpha.3 — check `package.json` or `npm ls @jml6m/skeletor`)
- **Node version:** (e.g., v20.19.0 — `node --version`)
- **OS:** (e.g., Windows 11, macOS 14, Ubuntu 24.04)
- **Shell:** (e.g., PowerShell 7, bash, zsh)

**Where does the bug occur?**

- [ ] CLI (`skeletor new`, `skeletor --help`, argument parsing, interactive prompts)
- [ ] Generator (file copy, `{{TOKEN}}` rendering, `.tmpl` suffix stripping)
- [ ] A specific template — which one? <!-- e.g. javascript, typescript, python -->
- [ ] A generated project's `verifyCommands` (install / lint / test / health / build)
- [ ] Docs / AGENTS.md

**Command run**

```bash
# The exact command that triggered the bug
skeletor new my-app --template typescript --yes --no-git
```

**Expected behavior**
A clear and concise description of what you expected to happen.

**Actual behavior**
What actually happened.

**Error / log output**

```text
Paste the relevant stdout / stderr here.
```

**Reproduction steps**

1. ...
2. ...
3. ...

**Test Context (if applicable)**
_If this defect was caught by a test suite:_

- **Failing Test Suite:** (e.g., `tests/generate.test.js`)
- **Command Run:** `npm test`
- **Error Output:**

```text
Paste the relevant test run output here
```

**Additional context**
<!-- e.g. tree of the generated project, diff between expected and actual file contents, related PRs -->
