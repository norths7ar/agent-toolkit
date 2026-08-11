# mcp-tools

个人本地 MCP 工具箱，每个子目录是独立可安装的 MCP 服务器（各自 pyproject / uv.lock / .venv，依赖互不干扰）。

| 子目录 | MCP 名 | 用途 |
|---|---|---|
| MiMo-MCP | mimo_vision | 云端 MiMo-V2.5 视觉，图片发小米 API（高精度/密集 OCR） |
| local-vision-mcp | local_vision | 本地 Qwen3-VL 视觉（Ollama），离线、私密、低成本 |
| local-translate-mcp | local_translate | 本地 Ollama 翻译 |

## 注册方式

Codex 在 `~/.codex/config.toml` 的 `[mcp_servers.*]` 里注册，command 指向对应子目录的 `.venv\Scripts\python.exe`，args 指向 `server.py`。
