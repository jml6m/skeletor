# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

Standard Maven Java {{PIN_RUNTIME_JAVA}}+ project. Build it and run it with
`mvn package && java -cp target/classes {{JAVA_PACKAGE}}.App`.

## Checks

Every check is a gate: the [CI workflows](./.github/workflows/) run them on every pull request and fail when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

There are no report-only checks.
