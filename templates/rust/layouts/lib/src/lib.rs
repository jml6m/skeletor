//! {{PROJECT_NAME}} library crate
//!
//! {{DESCRIPTION}}

/// Returns a greeting. Public API surface for downstream crates.
pub fn hello(name: &str) -> String {
    format!("Hello, {} from {{PROJECT_NAME}}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        assert_eq!(hello("tester"), "Hello, tester from {{PROJECT_NAME}}!");
    }
}