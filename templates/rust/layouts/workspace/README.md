# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo check
cargo test
cargo run -p {{PROJECT_NAME}}
```

A Cargo workspace. Run commands from the root; they cover every member crate.

```text
crates/core/   {{PROJECT_NAME}}-core, the library
crates/cli/    {{PROJECT_NAME}}, the binary, built on core
```

The toolchain is pinned in `rust-toolchain.toml`.
