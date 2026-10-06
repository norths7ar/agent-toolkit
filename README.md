# agent-toolkit

个人 Agent 指令、Skills 与 MCP 工具。

## 收集本机配置

[Backup-AgentConfig.ps1](Backup-AgentConfig.ps1) 将本机指令和 Skills 收集到仓库：

```powershell
pwsh -File ./Backup-AgentConfig.ps1 -Check
pwsh -File ./Backup-AgentConfig.ps1
```

`-Check` 只显示差异。支持 `-SkillsRoot`、`-CodexRoot` 指定源目录；Codex 默认目录优先取 `CODEX_HOME`，否则使用 `~/.codex/`。

- 收集全局 `AGENTS.md`，以及 Codex 目录下名含 `instructions` 的 Markdown 文件，包括保留的旧版本。
- 自动发现 Skills 源目录中含 `SKILL.md` 的各个子目录，复制其中的规则和配套资源。新增 Skill 无需维护名单。
- 延续原有过滤：跳过 Git、依赖和缓存目录、错误收集箱、`local` / `local-config.md`、`.env*` 与私钥文件。
- 仅更新有差异的文件，不自动删除仓库中已有的文件。项目模板、override 配置示例和 MCP 源码直接在仓库维护。

## 换机取用

- `instructions/AGENTS.md` 复制到 `~/.codex/AGENTS.md`。
- 基础指令按 [override 使用说明](instructions/base-instructions/README.md) 配置。
- `skills/` 中所需目录复制到 `~/.agents/skills/`；涉及本机路径的配置按对应 Skill 的说明填写。
- 项目模板从 `instructions/AGENTS.project-template.md` 取用。
- MCP 按各自 README 在新目录重建 uv 环境，并使用实际路径注册。

## MCP

- [MiMo-MCP](mcp/MiMo-MCP/)：已卸载停用的云端 MiMo 视觉分析原型，保留源码供参考。
- [local-vision-mcp](mcp/local-vision-mcp/)、[local-translate-mcp](mcp/local-translate-mcp/)：已停用的 Ollama 本地工具，保留源码供参考。
