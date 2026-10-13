# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo check
cargo test
```

A library crate: the public API is in `src/lib.rs`, with its unit tests in the same file. `cargo test` also runs
doc tests. The toolchain is pinned in `rust-toolchain.toml`.
