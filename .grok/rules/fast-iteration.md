# Fast Iteration

Some problems need a quick probe before they belong in tests or the CLI. Use short-lived scripts to learn fast, then promote or delete.

## When to reach for a scratch script

- You need to exercise one generator function (`copyAndRender`, `render`, token substitution) in isolation.
- You want to see exactly what a template emits without committing a generated project.
- A bug only shows up for a specific template id or token combination.

Prefer a 20-line probe over guessing from static reading.

## Conventions

- Generate into a throwaway dir and inspect it: `node src/index.js new /tmp/probe --template <id> --auto`, then read the output. Generated `gen-*/` dirs are gitignored.
- Put any reusable probe in `scripts/scratch/` with a descriptive name; run with `node scripts/scratch/<file>.mjs`.
- Import from `src/` instead of copying generator logic inline.
- Keep the generator itself (`copyAndRender` + `render`) dependency-free and simple — do not pull new deps in just to debug.
- Delete or promote when done. Do not leave debug probes in `src/` or `templates/`.

## Promoting to durable automation

Promote a probe when the check will be re-run after future changes and is stable enough to assert on:

1. Move it into a proper test under `tests/` (the suite auto-discovers templates).
2. Add an `npm run` script only if it will be used routinely.
3. Remove the scratch original.

## What not to do

- Do not hardcode absolute paths or secrets in probes.
- Do not add permanent `package.json` scripts for one-off investigations.
- Do not hand-edit a generated project and call it a template change — change the template, then regenerate.
