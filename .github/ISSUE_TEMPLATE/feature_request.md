---
name: Feature Request
about: Propose a new feature or enhancement for the skeletor CLI or its templates
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Summary

<!-- A concise description of the feature. What does it do? -->

## Motivation

<!--
  Why is this needed? What workflow / convention does it support?
  Reference active conventions (AGENTS.md, knip/jscpd/madge, release.js, etc.).
-->

## Scope

Which area(s) of skeletor does this affect?

- [ ] CLI surface (`src/index.js` — args, prompts, USAGE, interactive flow)
- [ ] Generator (`copyAndRender`, `render`, manifest loading)
- [ ] Template manifest schema (`template.json`: id, name, description, language, verifyCommands, ...)
- [ ] A specific existing template — which? <!-- javascript / typescript / python / rust / go / java / csharp -->
- [ ] A new template (which language / stack?)
- [ ] Tooling conventions (knip / jscpd / madge / prettier / eslint / husky / release.js)
- [ ] Docs (`README.md`, `AGENTS.md`, `.github/copilot-instructions.md`)
- [ ] Repo infra (CI, dependabot, issue/PR templates)

## Proposed behavior

<!--
  What does the CLI / generator do after this change?
  For CLI changes, include example invocations and expected output.
  For generator/template changes, describe the resulting file tree.
-->

## Manifest changes

<!--
  If `template.json` schema is changing, describe the new fields and their semantics.
  Current shape: { id, name, description, language, verifyCommands[] }.
-->

## Proposed File Modifications

### Existing files

- [ ] <!-- e.g. src/index.js (extend loadTemplateManifest defaults) -->
- [ ] <!-- e.g. templates/typescript/package.json.tmpl -->

### New files

- [ ] <!-- e.g. templates/<lang>/.jscpd.json -->
- [ ] <!-- e.g. src/features.js -->

## Backward compatibility

<!-- Does this break existing templates? Existing generated projects? If yes, describe the migration path. -->

## Acceptance Criteria

- [ ] <!-- e.g. `skeletor new x --template typescript --yes --no-git` produces a project with the new file -->
- [ ] <!-- e.g. `tests/generate.test.js` still passes for every discovered template -->
- [ ] <!-- e.g. New behavior is documented in README.md and/or AGENTS.md -->

## Testing Checklist

- [ ] Unit / integration tests pass (`npm test`)
- [ ] For each touched template: generated a project and ran its `verifyCommands`
- [ ] No `.tmpl` suffix leaks into generated output (asserted by `tests/generate.test.js`)
- [ ] Manual smoke test: `skeletor new ... --template <lang> --yes --no-git`
