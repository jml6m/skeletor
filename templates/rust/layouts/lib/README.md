# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

A library crate: the public API is in `src/lib.rs`, with its unit tests in the same file. `cargo test` also runs
doc tests. The toolchain is pinned in `rust-toolchain.toml`.

## Checks

Every check is a gate: [CI](./.github/workflows/ci.yml) runs them on every pull request and fails when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`cargo fmt` formats the tree; CI only checks it. There are no report-only checks.
