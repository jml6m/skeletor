## What
<!-- Briefly describe the changes in this PR -->

## Related Issues
<!--
  Use keywords to automatically close issues (e.g. "Closes #1").
  For multiple issues, use the keyword before each issue (e.g. "Closes #1, Fixes #2").
-->
<!-- Closes # -->

## Why
<!-- Explain the motivation or context for these changes -->

## How
<!--
  Describe the approach taken to implement these changes.
  Call out anything touching:
    - src/index.js (generator: parseArgs, copyAndRender, render, manifest loading)
    - templates/<language>/ (per-template files, *.tmpl rendering, template.json)
    - AGENTS.md (contract changes)
-->

## Templates Affected
<!-- Tick all that apply, or write "None" -->

- [ ] javascript
- [ ] typescript
- [ ] python
- [ ] rust
- [ ] go
- [ ] java
- [ ] csharp
- [ ] None (generator / docs / repo-level only)

## How Tested

- [ ] Tests pass (`npm test`)
- [ ] For any template touched: generated a project and ran its `verifyCommands`
- [ ] Manual smoke test: `skeletor new <name> --template <lang> --yes --no-git`

## Checklist

- [ ] Code follows project conventions (see [AGENTS.md](../AGENTS.md))
- [ ] No hardcoded secrets or API keys
- [ ] No `.tmpl` files leak into generated projects (covered by existing tests)
- [ ] If a template gained a new tool, its output paths are in that template's `.gitignore`
- [ ] Changes are minimal and focused on the issue
