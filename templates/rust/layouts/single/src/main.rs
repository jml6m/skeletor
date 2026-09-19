//! {{PROJECT_NAME}}
//!
//! {{DESCRIPTION}}

const PROJECT: &str = "{{PROJECT_NAME}}";

fn main() {
    println!("{}", hello("world"));
}

/// Returns a greeting. Kept public for tests.
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
