# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

A single binary crate: `src/main.rs` holds `main` and its unit tests. Run it with `cargo run`. The toolchain is
pinned in `rust-toolchain.toml`.

## Checks

Every check is a gate: [CI](./.github/workflows/ci.yml) runs them on every pull request and fails when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`cargo fmt` formats the tree; CI only checks it. There are no report-only checks.
