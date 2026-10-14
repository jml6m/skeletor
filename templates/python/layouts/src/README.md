# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

[uv](https://docs.astral.sh/uv/) manages the Python version (`.python-version`), the virtual environment and dependencies.

```bash
uv sync                  # creates .venv and uv.lock
uv run ruff format .
uv run ruff check .
uv run pytest
uv run mypy src
```

Commit `uv.lock` after the first `uv sync`, so every machine and CI install the same versions. Add dependencies with
`uv add <package>`, or `uv add --dev <package>` for the `dev` group; both update `pyproject.toml` and `uv.lock`.

This is an installable package with a `src/` layout: ruff for lint and format, pytest, and strict mypy.

See AGENTS.md for AI agent protocols.
