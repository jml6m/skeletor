"""Example entry point for {{PROJECT_NAME}}."""

def hello(name: str = "world") -> str:
    """Return a friendly greeting."""
    return f"Hello, {name} from {{PROJECT_NAME}}!"

if __name__ == "__main__":
    print(hello())
