# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Development

```bash
python -m pip install --group dev   # pip 25.1+ (or: uv sync)
python -m ruff format .
python -m ruff check .
python -m pytest
python -m mypy .
```

Scripts live at the repo root and run by filename (`python main.py`). `pyproject.toml` holds tool config and the
`dev` dependency group only, with no packaging. If this grows into a library you want to publish, re-scaffold
with `--layout src`.

See AGENTS.md for AI agent protocols.
