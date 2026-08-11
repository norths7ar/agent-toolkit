# Local Translate MCP

An stdio MCP server that translates text through a local Ollama instance. It
uses the tested `qwen3:4b-translate` model and Ollama's Chat API, not the
`ollama run` CLI path.

## Requirements

- Ollama is installed and running.
- `qwen3:4b-translate` appears in `ollama list`.
- Python dependencies are installed with `uv sync`.

The server requires neither an API key nor a `.env` file. It sends text only to
`http://127.0.0.1:11434/api/chat`. Each request sets `keep_alive: 0`, so Ollama
unloads the model after returning the translation.

## Tool

`translate_text(text, source_language="Chinese", target_language="English")`

The tool returns the translation, selected model, source/target labels, and
elapsed time. It accepts up to 20,000 input characters and defensively removes
an accidental Qwen `<think>...</think>` prefix from a response.

## Local checks

```powershell
uv run python -m unittest -v
uv run python verify_mcp.py
uv run ruff check .
uv run ruff format --check .
```

## Codex registration

Register an stdio MCP server with:

- Command: `E:\GitHub-Repos\local-translate-mcp\.venv\Scripts\python.exe`
- Arguments: `E:\GitHub-Repos\local-translate-mcp\server.py`
- Working directory: `E:\GitHub-Repos\local-translate-mcp`

No environment variables are needed by default. Optional overrides are
`OLLAMA_BASE_URL` and `OLLAMA_TRANSLATE_MODEL`.
