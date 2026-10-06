# MiMo Vision MCP

通过 MiMo API 分析图片，提供 `analyze_image(image_path, question)`。当前已停用。

项目目录的 `.env` 配置 `XIAOMI_API_KEY=...`，然后运行：

```powershell
uv run python server.py
```

MCP 使用 stdio；注册时将工作目录设为本项目目录。图片限项目目录内，会上传至 MiMo API。

默认模型 `mimo-v2.5`；可通过 `MIMO_MODEL`、`MIMO_BASE_URL` 覆盖。

验证：`uv run python verify_mcp.py test_image1.jpg`。
