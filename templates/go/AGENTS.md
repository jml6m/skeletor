# Go Project — Agent Guidelines

**Project:** {{PROJECT_NAME}}
**Language:** Go

- Use `go build`, `go test`, `go mod tidy`.
- Keep packages small and well-tested.
- Follow standard Go conventions (gofmt, effective go).
- Update this file + README when standards evolve.

### GitHub credentials — never commit values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never numeric ID. Workflows may use secret *names* only
(e.g. `${{ secrets.APP_ID }}`).

