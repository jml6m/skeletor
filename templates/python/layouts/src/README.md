# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
python -m pip install -e '.[dev]'
python -m ruff format .
python -m ruff check .
python -m pytest
python -m mypy src
```

This is an installable package with a `src/` layout: ruff for lint and format, pytest, and strict mypy.

See AGENTS.md for AI agent protocols.
