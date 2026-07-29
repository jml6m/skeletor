# Rust Project — Agent Guidelines

**Project:** {{PROJECT_NAME}}
**Language:** Rust

- Use `cargo check`, `cargo test`, `cargo clippy` if available.
- Prefer idiomatic Rust, ownership, and good error handling.
- Keep main.rs or lib.rs focused.
- Update this file when project conventions change.

### GitHub credentials — never commit values

Do **not** commit GitHub App IDs, installation IDs, client IDs/secrets, private keys,
PATs, tokens, webhook secrets, or Actions secret/variable **values**. Refer to apps by
slug/name, never numeric ID. Workflows may use secret *names* only
(e.g. `${{ secrets.APP_ID }}`).

