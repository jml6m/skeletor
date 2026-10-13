# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
dotnet run --project src/{{CSHARP_NAMESPACE}}
```

A .NET console app targeting `{{PIN_TARGET_FRAMEWORK}}`, with xUnit tests in their own project:

```text
{{CSHARP_NAMESPACE}}.slnx                 solution; dotnet build/test at the root use it
src/{{CSHARP_NAMESPACE}}/                 the app, built as {{CSHARP_NAMESPACE}}.dll
tests/{{CSHARP_NAMESPACE}}.Tests/         xUnit tests, referencing the app
```

Test packages are referenced only by the test project, so they don't ship with the app.

## Checks

Every check is a gate: [CI](./.github/workflows/ci.yml) runs them on every pull request and fails when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

There are no report-only checks.
