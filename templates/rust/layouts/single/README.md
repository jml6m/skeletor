# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo check
cargo test
cargo run
```

A single binary crate: `src/main.rs` holds `main` and its unit tests. The toolchain is pinned in
`rust-toolchain.toml`.
