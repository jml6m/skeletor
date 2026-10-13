# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

Standard Maven Java {{PIN_RUNTIME_JAVA}}+ project.

## Checks

Every check is a gate: [CI](./.github/workflows/ci.yml) runs them on every pull request and fails when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

There are no report-only checks.
