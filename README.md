# agent-toolkit

个人 Agent 工具与配置备份。MCP 实现代码在本仓库维护；自定义 Skills 和全局规则在本机用户目录编辑，本仓库保存它们的版本化备份。

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
| [skills/git-safe-workflow](skills/git-safe-workflow/) | Git / gh 权限与签名失败处理、提交规范 |

本机 `~/.agents/skills/` 与 `~/.codex/AGENTS.md` 是工作源。日常在这些位置创建和修改规则，仓库中的 `skills/` 与 `instructions/AGENTS.md` 保存版本化备份。

## 备份与恢复

日常备份，加 `-Check` 可预览变更：

```powershell
pwsh -File ./scripts/Backup-AgentConfig.ps1
pwsh -File ./scripts/Backup-AgentConfig.ps1 -Check
```

`scripts/agent-config.json` 列出要备份的自定义 Skill，另固定收集全局 `AGENTS.md`。新增 Skill 后更新清单。备份范围为规则及配套资源，机器配置和错误案例留在本机。

恢复先预览，确认后加 `-Apply` 执行：

```powershell
pwsh -File ./scripts/Restore-AgentConfig.ps1
pwsh -File ./scripts/Restore-AgentConfig.ps1 -Apply
```

覆盖前的文件保存在 `local/restore-backups/`。目标侧多出的文件会列出供人工核对；源文件缺失时保留现状并报错。复制完成后进行哈希校验，提交推送前查看 Git diff。

两个入口支持 `-SkillsRoot`、`-CodexRoot` 指定本机位置。默认使用用户目录下的 `.agents/skills`，以及 `CODEX_HOME` 或用户目录下的 `.codex`。

MCP 源码直接在仓库内维护，依赖环境按各项目说明重建。`errors/` 保存本机错误案例；PowerShell Skill 的 `local-config.md` 指定收件箱位置，缺少配置时使用任务临时目录。整理案例后修改本机 Skill，再运行备份。

## 存档

2026-09-05：本机已卸载 Ollama，以下两个本地 MCP 已停用并停止维护。保留源码、测试和依赖锁文件供参考；目录内的历史注册说明不代表当前部署状态。

| 目录 | MCP 名 | 原用途 |
| --- | --- | --- |
| [archive/local-vision-mcp](archive/local-vision-mcp/) | local_vision | 基于本地 Ollama / Qwen3-VL 的视觉分析 |
| [archive/local-translate-mcp](archive/local-translate-mcp/) | local_translate | 基于本地 Ollama 的翻译 |

如需重新启用，请在相应存档目录重建环境，并重新验证模型、路径和客户端注册配置。
