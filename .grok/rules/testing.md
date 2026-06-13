# Testing

This repo is a generator plus a set of templates. Tests should protect the generator contract, not the contents of every downstream language.

## Principles

- The Jest suite in `tests/` auto-discovers templates via `getTemplatesWithManifests()` and asserts the manifest contract (`id`, `name`, `description`, `language`, `verifyCommands`). Adding a template means it is automatically exercised — keep the manifest valid.
- Test the generator behavior (token substitution, `.tmpl` suffix stripping, `--auto` non-interactivity), not the runtime of every generated stack.
- Keep generation deterministic: same inputs produce the same tree. Do not introduce time/random-dependent output.
- `--auto` must remain fully non-interactive — a regression here breaks scripting/CI and must be covered.

## Layered validation

1. **Every task** — `npm test` + `npm run lint` (encoding gate) + `npm run audit:ci` (audit gate). Never skip these.
2. **Generator changes** — add/extend a unit test for the changed behavior.
3. **New template** — ensure `template.json` is valid; the contract test covers it. Optionally smoke it: `node src/index.js new <tmp> --template <id> --auto` then run the template's `verifyCommands`.

Match depth to what you touched, but never skip lint + test. Call out residual risk when a layer could not be exercised locally.
