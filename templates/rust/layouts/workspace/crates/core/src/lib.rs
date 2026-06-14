//! Core library for {{PROJECT_NAME}}

pub fn hello(name: &str) -> String {
    format!("Hello, {} from {{PROJECT_NAME}}-core!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        assert_eq!(
            hello("tester"),
            "Hello, tester from {{PROJECT_NAME}}-core!"
        );
    }
}