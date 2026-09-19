"""Basic tests for {{PROJECT_NAME}}."""

from main import hello


def test_hello_default() -> None:
    assert hello() == "Hello, world from {{PROJECT_NAME}}!"


def test_hello_custom() -> None:
    assert hello("tester") == "Hello, tester from {{PROJECT_NAME}}!"
