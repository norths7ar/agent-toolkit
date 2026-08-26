# Local Vision MCP

An stdio MCP server for private image analysis through local Ollama and
`qwen3-vl:8b`.

`analyze_image(image_path, question)` accepts a specified JPEG, PNG, or WebP
file up to 20 MiB, including an absolute path outside this project. It sends
image bytes only to `http://127.0.0.1:11434/api/chat`, never to an external API.

Use it for privacy-sensitive images, ordinary screenshot descriptions, and
low-risk OCR. For dense text, tiny visual details, or high-confidence visual
decisions, use the existing MiMo MCP instead.

## Checks

```powershell
uv run python -m unittest -v
uv run python verify_mcp.py E:\GitHub-Repos\MiMo-MCP\test_image1.jpg
uv run ruff check .
uv run ruff format --check .
```

## Codex registration

- Command: `E:\GitHub-Repos\mcp-tools\local-vision-mcp\.venv\Scripts\python.exe`
- Arguments: `E:\GitHub-Repos\mcp-tools\local-vision-mcp\server.py`
- Working directory: `E:\GitHub-Repos\mcp-tools\local-vision-mcp`

Optional overrides: `OLLAMA_BASE_URL`, `OLLAMA_VISION_MODEL`, and
`LOCAL_VISION_KEEP_ALIVE`. The last accepts Ollama `keep_alive` values such as
`0`, `5m`, or `10m`; leave it unset to use `5m`.
