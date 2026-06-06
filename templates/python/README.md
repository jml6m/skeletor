# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
python -m pip install -e '.[dev]'
python -m ruff format .
python -m ruff check .
python -m pytest
```

This template uses modern Python best practices (ruff for lint+format, pytest, strict mypy, src layout).

See AGENTS.md for AI agent protocols.
