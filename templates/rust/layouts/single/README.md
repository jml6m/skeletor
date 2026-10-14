# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

A single binary crate: `src/main.rs` holds `main` and its unit tests. Run it with `cargo run`.
`rust-toolchain.toml` selects the `{{PIN_RUNTIME_RUST_CHANNEL}}` toolchain with rustfmt and clippy.

## Checks

Every check is a gate: the [CI workflows](./.github/workflows/) run them on every pull request and fail when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`cargo fmt` formats the tree; CI only checks it. There are no report-only checks.
