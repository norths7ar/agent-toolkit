# Local Translate MCP

> 存档（2026-09-05）：本机已卸载 Ollama，此 MCP 已停用并停止维护。源码、测试和依赖锁文件保留供参考；下文为历史说明，其中注册路径不再适用。若重新启用，请按当前目录重建环境并重新验证。

An stdio MCP server that translates text through a local Ollama instance. It
uses the tested `qwen3:4b-translate` model and Ollama's Chat API, not the
`ollama run` CLI path.

## Requirements

- Ollama is installed and running.
- `qwen3:4b-translate` appears in `ollama list`.
- Python dependencies are installed with `uv sync`.

The server requires neither an API key nor a `.env` file. It sends text only to
`http://127.0.0.1:11434/api/chat`. Requests keep the model loaded for two idle
minutes by default, so related translations avoid a cold start before Ollama
releases the GPU memory.

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

- Command: `E:\GitHub-Repos\mcp-tools\local-translate-mcp\.venv\Scripts\python.exe`
- Arguments: `E:\GitHub-Repos\mcp-tools\local-translate-mcp\server.py`
- Working directory: `E:\GitHub-Repos\mcp-tools\local-translate-mcp`

Optional overrides are `OLLAMA_BASE_URL`, `OLLAMA_TRANSLATE_MODEL`, and
`LOCAL_TRANSLATE_KEEP_ALIVE`. The last accepts Ollama `keep_alive` values such
as `0`, `2m`, or `10m`; leave it unset to use `2m`.
