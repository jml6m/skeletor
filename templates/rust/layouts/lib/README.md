# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

A library crate: the public API is in `src/lib.rs`, with its unit tests in the same file. `cargo test` also runs
doc tests. `rust-toolchain.toml` selects the `{{PIN_RUNTIME_RUST_CHANNEL}}` toolchain with rustfmt and clippy.
Commit the `Cargo.lock` the first build creates; Cargo recommends it for every crate.

## Checks

Every check is a gate: the [CI workflows](./.github/workflows/) run them on every pull request and fail when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`cargo fmt` formats the tree; CI only checks it. There are no report-only checks.
