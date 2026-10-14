"""Basic tests for {{PROJECT_NAME}}."""

from main import PROJECT, hello


def test_hello_default() -> None:
    assert hello() == f"Hello, world from {PROJECT}!"


def test_hello_custom() -> None:
    assert hello("tester") == f"Hello, tester from {PROJECT}!"
