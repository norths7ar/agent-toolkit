# mcp-tools

个人本地 MCP 工具箱，每个子目录是独立可安装的 MCP 服务器（各自 pyproject / uv.lock / .venv，依赖互不干扰）。

| 子目录 | MCP 名 | 用途 |
| --- | --- | --- |
| MiMo-MCP | mimo_vision | 云端 MiMo-V2.5 视觉，图片发小米 API（高精度/密集 OCR） |
| local-vision-mcp | local_vision | 本地 Qwen3-VL 视觉（Ollama），离线、私密、低成本 |
| local-translate-mcp | local_translate | 本地 Ollama 翻译 |

## 注册方式

Codex 在 `~/.codex/config.toml` 的 `[mcp_servers.*]` 里注册，command 指向对应子目录的 `.venv\Scripts\python.exe`，args 指向 `server.py`。

## 本地模型生命周期

`local_translate` 和 `local_vision` 的每个请求都会分别向 Ollama 传递有限的 `keep_alive`：翻译默认 `2m`，视觉默认 `5m`。连续请求可复用已加载模型；闲置后由 Ollama 自动释放显存。

在 Codex 对应 MCP 的 Environment variables 中按需设置 `LOCAL_TRANSLATE_KEEP_ALIVE` 或 `LOCAL_VISION_KEEP_ALIVE`，可覆盖默认值。有效值遵循 Ollama，例如 `0` 为回复后立刻卸载，`10m` 为闲置十分钟后卸载。

Ollama 服务还设置了 `OLLAMA_MAX_LOADED_MODELS=1`，限制同一时间最多保留一个本地模型，避免视觉、翻译等模型驻留叠加占满显存。需要立刻释放某个模型时，在终端运行 `ollama stop <model>`。
