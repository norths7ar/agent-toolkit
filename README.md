# agent-toolkit

个人 Agent 辅助工具与 Skills。MCP 项目独立管理依赖（各自 pyproject.toml / uv.lock / .venv），Skills 在 skills/ 中独立维护。

## 非存档项目

| 目录 | MCP 名 | 用途 |
| --- | --- | --- |
| [MiMo-MCP](MiMo-MCP/) | mimo_vision | 云端 MiMo-V2.5 视觉，图片发小米 API（高精度/密集 OCR） |

## 注册方式

Codex 在 `~/.codex/config.toml` 的 `[mcp_servers.*]` 里注册，command 指向对应项目目录的 `.venv\Scripts\python.exe`，args 指向 `server.py`。具体配置与验证步骤见项目内说明。

## Skills

| 目录 | 用途 |
| --- | --- |
| [skills/delegation-router](skills/delegation-router/) | 由主模型裁量任务委派、模型层级和团队组织 |
| [skills/powershell-safe-invocation](skills/powershell-safe-invocation/) | PowerShell 执行兜底与失败案例回收 |

`skills/` 是唯一维护源，用户目录下的 `.agents/skills/` 是部署副本。修改仓库版本后单向同步，不直接维护两套正文。

本机同步入口为 `local/sync-skills.ps1`；运行 `pwsh -NoProfile -File ./local/sync-skills.ps1 -Check` 可只检查冲突，去掉 `-Check` 执行同步。脚本只管理上述两个 Skill，检测部署副本是否被直接修改，不自动删除文件；遇到差异先合并再同步。

`local/` 中的同步脚本与同步状态不纳入 Git，克隆仓库后需要自行配置本机部署入口。脚本在 PowerShell Skill 部署目录生成 `local-config.md`，将失败收件箱指向本仓库的 `errors/powershell-safe-invocation/`；无本机配置或目录不可写时，Skill 使用任务临时目录。

`errors/` 中的原始案例不纳入 Git。普通任务仅记录经过脱敏的失败和验证结果；后续专门整理时才将有效经验提炼回 Skill。

## 存档

2026-09-05：本机已卸载 Ollama，以下两个本地 MCP 已停用并停止维护。保留源码、测试和依赖锁文件供参考；目录内的历史注册说明不代表当前部署状态。

| 目录 | MCP 名 | 原用途 |
| --- | --- | --- |
| [archive/local-vision-mcp](archive/local-vision-mcp/) | local_vision | 基于本地 Ollama / Qwen3-VL 的视觉分析 |
| [archive/local-translate-mcp](archive/local-translate-mcp/) | local_translate | 基于本地 Ollama 的翻译 |

如需重新启用，请在相应存档目录重建环境，并重新验证模型、路径和客户端注册配置。
