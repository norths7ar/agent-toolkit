# MiMo Vision MCP 原型

这个项目是一个**临时、本地、stdio** 的 MCP server：它不改变 Codex 或 OpenCodex 的持久配置，也不代理 DeepSeek。它只证明一条最小链路：一个文本模型调用 `analyze_image` 工具后，工具把本地图片发给 MiMo-V2.5，并把 MiMo 的文字观察结果返回。

## 文件如何协作

```text
Codex / 其他 MCP 客户端
        │  JSON-RPC（stdin/stdout）
        ▼
server.py
  └─ analyze_image(image_path, question)
        │  读取项目内测试图并转 data URL
        ▼
https://api.xiaomimimo.com/v1/chat/completions
        │  MiMo-V2.5 的文字分析
        ▼
JSON 工具结果 { image, model, analysis }
```

- `server.py`：MCP server 和 MiMo API 调用；它限制图片必须位于本项目内，避免一个工具调用读取并外发任意本地文件。
- `probe_mimo.py`：绕过 MCP，直接验证“图片 → MiMo → 文字”的能力。
- `verify_mcp.py`：作为一个独立 MCP client 启动 `server.py` 子进程、列出工具、调用工具；这是不注册到 Codex 的完整 stdio 往返验证。
- `test_server.py`：不访问网络的单元测试，检查路径边界和请求体。
- `.env`：仅保存密钥；不会被 Git 纳入版本控制。

## 已有配置

`.env` 必须含有：

```dotenv
XIAOMI_API_KEY=...
DEEPSEEK_API_KEY=...
```

本原型只使用 `XIAOMI_API_KEY`。`DEEPSEEK_API_KEY` 为以后验证 DeepSeek 调用 MCP 保留，当前不读取、不发送。

可选覆盖项：

```dotenv
MIMO_MODEL=mimo-v2.5
MIMO_BASE_URL=https://api.xiaomimimo.com/v1/chat/completions
```

## 运行顺序

在项目目录执行：

```powershell
uv run python -m unittest -v
uv run python probe_mimo.py test_image1.jpg --question "画面中人物戴了什么？"
uv run python verify_mcp.py test_image2.jpg --question "画面包含哪些主体、颜色和天体？"
```

第二条命令验证 MiMo 多模态 API；第三条额外验证 MCP 的工具发现和 stdio JSON-RPC 调用。两条真实调用都会把所选图片发往小米 API，可能消耗额度。

## 当前不做的事

- 不在 Codex 中注册这个 MCP server；因此不会影响任何会话或现有 DeepSeek 路由。
- 不让 DeepSeek 自动获得聊天附件。附件如何成为工具的 `image_path`，以及 DeepSeek 经 OpenCodex 是否能发起 MCP tool call，需要在本原型通过后单独验证。
- 不通过 `DEEPSEEK_API_KEY` 调用 DeepSeek；这不是“DeepSeek 调用 MCP”的验证，后续应由 Codex 客户端实际完成。
