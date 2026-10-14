# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

[uv](https://docs.astral.sh/uv/) manages the Python version (`.python-version`), the virtual environment and dependencies.

```bash
uv sync                  # creates .venv and uv.lock
uv run ruff format .
uv run ruff check .
uv run pytest
uv run mypy src tests
```

Commit `uv.lock` after the first `uv sync`, so every machine and CI install the same versions. Add dependencies with
`uv add <package>`, or `uv add --dev <package>` for the `dev` group; both update `pyproject.toml` and `uv.lock`.

This is an installable package with a `src/` layout: ruff for lint and format, pytest, and strict mypy. Run it
with `uv run python -m app.main`.

## Checks

Every check is a gate: the [CI workflows](./.github/workflows/) run them on every pull request and fail when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`uv run ruff format .` formats the tree; CI only checks it. There are no report-only checks.

See AGENTS.md for AI agent protocols.
