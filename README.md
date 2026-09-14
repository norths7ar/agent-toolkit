# agent-toolkit

个人 Agent 指令、Skills 与 MCP 工具。

| 目录 | 内容 | 平时在哪里维护 |
| --- | --- | --- |
| [instructions](instructions/) | 全局 AGENTS、项目 AGENTS 模板 | 全局规则在 `~/.codex/AGENTS.md`；模板直接在仓库修改 |
| [skills](skills/) | delegation-router、git-safe-workflow、powershell-safe-invocation | 本机 `~/.agents/skills/` |
| [mcp](mcp/) | MiMo 视觉 MCP 原型及历史工具 | 直接在仓库修改 |
| [scripts](scripts/) | 指令与 Skill 的备份入口 | 直接在仓库修改 |

## 备份

```powershell
pwsh -File ./scripts/Backup-AgentConfig.ps1
```

收集 `scripts/agent-config.json` 列出的自定义 Skill，以及全局 AGENTS；新增 Skill 时更新清单。加 `-Check` 可只查看差异，支持 `-SkillsRoot`、`-CodexRoot` 指定源目录。模板和 MCP 源码直接通过 Git 保存。

## 换机取用

- `instructions/AGENTS.md` 复制到 `~/.codex/AGENTS.md`。
- `skills/` 中所需目录复制到 `~/.agents/skills/`。
- 项目模板从 `instructions/AGENTS.project-template.md` 取用。
- MCP 按各自 README 在新目录重建 uv 环境，并使用实际路径注册。

## MCP

- [MiMo-MCP](mcp/MiMo-MCP/)：云端 MiMo 视觉分析原型。
- [local-vision-mcp](mcp/archive/local-vision-mcp/)、[local-translate-mcp](mcp/archive/local-translate-mcp/)：已停用的 Ollama 本地工具，源码放在 `mcp/archive/`。
