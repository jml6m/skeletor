# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

[uv](https://docs.astral.sh/uv/) manages the Python version (`.python-version`), the virtual environment and dependencies.

```bash
uv sync                  # creates .venv and uv.lock
uv run ruff format .
uv run ruff check .
uv run pytest
uv run mypy .
```

Commit `uv.lock` after the first `uv sync`, so every machine and CI install the same versions. Add dependencies with
`uv add <package>`, or `uv add --dev <package>` for the `dev` group; both update `pyproject.toml` and `uv.lock`.

Scripts live at the repo root and run by filename (`uv run main.py`). `pyproject.toml` holds tool config and the
`dev` dependency group only, with no packaging. If this grows into a library you want to publish, re-scaffold
with `--layout src`.

## Checks

Every check is a gate: [CI](./.github/workflows/ci.yml) runs them on every pull request and fails when one does.
AGENTS.md lists the same commands.

```bash
{{VERIFY_COMMANDS}}
```

`uv run ruff format .` formats the tree; CI only checks it. There are no report-only checks.

See AGENTS.md for AI agent protocols.
