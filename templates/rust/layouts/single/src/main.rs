//! {{PROJECT_NAME}}
//!
//! {{DESCRIPTION}}

fn main() {
    println!("{}", hello("world"));
}

/// Returns a greeting. Kept public for tests.
pub fn hello(name: &str) -> String {
    format!("Hello, {} from {{PROJECT_NAME}}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        assert_eq!(
            hello("tester"),
            "Hello, tester from {{PROJECT_NAME}}!"
        );
    }
}
