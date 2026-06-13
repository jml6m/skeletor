# Session Validation (Mandatory)

Before ending any implementation task in this repo, run validation and report results explicitly. Do not claim success without executing these checks.

## Required closeout checklist

Run in order. Stop and fix failures before handing work back.

| Step | Command | When required |
|------|---------|---------------|
| 1. Encoding | `npm run lint:encoding` | **Always** — no BOM / CRLF / non-UTF-8 / control chars. |
| 2. Audit | `npm run audit:ci` | **Always** — zero critical/high advisories. |
| 3. Tests | `npm test` | **Always** — full Jest suite passes. |
| 4. Generation smoke | `node src/index.js new <tmp> --template <id> --yes` | When the generator or a template changed. |

`npm run lint` runs step 1 (the encoding gate) only. Step 2 (`npm run audit:ci`) is a separate command — it is also run by `npm run npm:reinstall` and enforced in CI.

## Reporting policy

In the final response, include a short **Validation** section listing each command and pass/fail, e.g.:

```
Validation: lint:encoding ✓ | audit:ci ✓ | test ✓
```

If a step was skipped, say why and call out residual risk.

## Commit / push protocol

Per `AGENTS.md`, pushing is **not** automatic. After validation passes: `git add -A`, commit with a descriptive message, `git push -u origin HEAD`. Do this explicitly every time the user wants the remote in sync.
