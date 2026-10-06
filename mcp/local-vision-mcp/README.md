# Local Vision MCP

通过本地 Ollama 分析图片，提供 `analyze_image(image_path, question)`。当前已停用。

启动 Ollama 并准备 `qwen3-vl:8b` 模型，然后在项目目录运行：

```powershell
uv run python server.py
```

MCP 使用 stdio；注册时将工作目录设为本项目目录。支持 JPEG、PNG、WebP，最大 20 MiB。

可配置 `OLLAMA_BASE_URL`、`OLLAMA_VISION_MODEL`、`LOCAL_VISION_KEEP_ALIVE`（默认 `5m`）。

验证：`uv run python verify_mcp.py ..\MiMo-MCP\test_image1.jpg`。
