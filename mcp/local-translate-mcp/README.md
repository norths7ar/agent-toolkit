# Local Translate MCP

通过本地 Ollama 翻译文本，提供 `translate_text(text, source_language="Chinese", target_language="English")`。当前已停用。

启动 Ollama 并准备 `qwen3:4b-translate` 模型，然后在项目目录运行：

```powershell
uv run python server.py
```

MCP 使用 stdio；注册时将工作目录设为本项目目录。单次输入最多 20,000 字符。

可配置 `OLLAMA_BASE_URL`、`OLLAMA_TRANSLATE_MODEL`、`LOCAL_TRANSLATE_KEEP_ALIVE`（默认 `2m`）。

验证：`uv run python verify_mcp.py`。
