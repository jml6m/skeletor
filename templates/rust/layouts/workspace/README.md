# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

A Cargo workspace. Run commands from the root; they cover every member crate. Run the binary with
`cargo run -p {{PROJECT_NAME}}`.

```text
crates/core/   {{PROJECT_NAME}}-core, the library
crates/cli/    {{PROJECT_NAME}}, the binary, built on core
```

`rust-toolchain.toml` selects the `{{PIN_RUNTIME_RUST_CHANNEL}}` toolchain with rustfmt and clippy.

## Checks

Every check is a gate: the [CI workflows](./.github/workflows/) run them on every pull request and fail when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`cargo fmt` formats the tree; CI only checks it. There are no report-only checks.
