# C# Project — Agent Guidelines

**Project:** {{PROJECT_NAME}}
**Language:** C# (.NET)

- Build: `dotnet build`, test: `dotnet test`.
- Use modern C# features (records, pattern matching, nullable).
- Prefer xUnit for tests.
- Keep Program.cs or entry points minimal.
- Update this file with any additional .NET conventions.

### GitHub credentials — never commit values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never numeric ID. Workflows may use secret *names* only
(e.g. `${{ secrets.APP_ID }}`).

