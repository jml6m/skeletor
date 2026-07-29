# Python Project — Agent Guidelines

**Project:** {{PROJECT_NAME}}
**Language:** Python

Use ruff for formatting and linting (`ruff format`, `ruff check`).
Run tests with `pytest`.
Prefer `pyproject.toml` for all configuration.
Keep functions small and well-typed.
Update this file when conventions change.

### GitHub credentials — never commit values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never numeric ID. Workflows may use secret *names* only
(e.g. `${{ secrets.APP_ID }}`).

