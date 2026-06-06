"""Basic tests for {{PROJECT_NAME}}."""

from app.main import hello

def test_hello_default():
    assert hello() == "Hello, world from {{PROJECT_NAME}}!"

def test_hello_custom():
    assert hello("tester") == "Hello, tester from {{PROJECT_NAME}}!"
