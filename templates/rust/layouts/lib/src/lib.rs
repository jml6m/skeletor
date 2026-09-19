//! {{PROJECT_NAME}} library crate
//!
//! {{DESCRIPTION}}

const PROJECT: &str = "{{PROJECT_NAME}}";

/// Returns a greeting. Public API surface for downstream crates.
pub fn hello(name: &str) -> String {
    format!("Hello, {name} from {PROJECT}!")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        assert_eq!(hello("tester"), format!("Hello, tester from {PROJECT}!"));
    }
}
