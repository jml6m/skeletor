# Java Project — Agent Guidelines

**Project:** {{PROJECT_NAME}}
**Language:** Java (Maven)

- Build with `mvn clean compile`, test with `mvn test`.
- Use JUnit 5 for tests.
- Follow standard package naming and clean architecture.
- Update this file with any team-specific Java conventions.

### GitHub credentials — never commit values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never numeric ID. Workflows may use secret *names* only
(e.g. `${{ secrets.APP_ID }}`).

