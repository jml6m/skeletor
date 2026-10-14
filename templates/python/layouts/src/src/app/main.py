"""Example entry point for {{PROJECT_NAME}}."""

PROJECT = "{{PROJECT_NAME}}"


def hello(name: str = "world") -> str:
    """Return a friendly greeting."""
    return f"Hello, {name} from {PROJECT}!"


if __name__ == "__main__":
    print(hello())
