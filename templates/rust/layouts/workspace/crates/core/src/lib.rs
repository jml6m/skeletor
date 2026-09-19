//! Core library for {{PROJECT_NAME}}

const PROJECT: &str = "{{PROJECT_NAME}}-core";

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
