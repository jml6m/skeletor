# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

A standard Go module. Run it with `go run .`.

## Checks

Every check is a gate: the [CI workflows](./.github/workflows/) run them on every pull request and fail when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`go mod tidy` updates go.mod and go.sum; CI only checks them. There are no report-only checks.
