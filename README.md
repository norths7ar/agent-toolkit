# agent-toolkit

个人 AI 工作流工具集。

## 指令与 Skills

| 内容 | 用法 |
| --- | --- |
| [Codex 全局指令](codex/instructions/AGENTS.md) | 按需修改后放入 Codex 配置目录的 `AGENTS.md` |
| [模型基础指令](codex/instructions/base-instructions/) | Astra、Sol、Terra、Luna 的提示词，供取用和修改 |
| [项目指令模板](AGENTS.project-template.md) | 作为项目根目录 `AGENTS.md` 的起点 |
| [Skills](skills/) | 将需要的 Skill 目录复制到 `~/.agents/skills/`，用法见各自的 `SKILL.md` |
| [DSH 指令](deepseek-harness/instructions/) | DSH 全局指令和模型提示词，供参考和取用 |

使用经验见[我如何使用 Codex](docs/how-i-use-codex.md)。

## DeepSeek Harness 插件

### 独立插件

在 DSH 的“插件 → 添加插件”中输入对应 GitHub 仓库链接即可安装。详细用法见各插件 README。

| 插件 | 用途 |
| --- | --- |
| [提示词](https://github.com/norths7ar/dsh-model-guidance) | 为不同模型设置提示词与行为偏好 |
| [任务通知](https://github.com/norths7ar/dsh-task-notifications) | 任务结束或需要处理时提醒，点击通知进入对应会话 |
| [模型更新](https://github.com/norths7ar/dsh-model-updater) | 查询提供商的模型列表，对比并更新 DSH 模型配置 |

本仓库通过 submodule 收录这三个插件。需要源码时，克隆后运行：

```sh
git submodule update --init --recursive
```

### 其他插件

- [第二意见](deepseek-harness/plugins/dsh-second-opinion/README.md)：在回复旁邀请其他模型，先预览意见，再选择是否创建分支继续聊。
- [最新消息撤回与修改](deepseek-harness/plugins/dsh-latest-message-edit/)：将最新用户消息带回输入框修改，保留已经执行的工具操作及结果。

下载仓库后，在 DSH 的“插件 → 添加插件”中选择对应插件目录安装。

相关文档：[前端设计约定](deepseek-harness/docs/frontend-design.md)、[DSH 已知问题](deepseek-harness/docs/known-issues.md)。

## 辅助脚本

以下命令在仓库根目录使用 PowerShell 7 运行。带 `-Check` 时预览变更，去掉后执行。

### 收集指令和 Skills

[Backup-AgentConfig.ps1](Backup-AgentConfig.ps1) 将 Codex、DSH 的全局 AGENTS.md 和 Skills 备份到本仓库。模型提示词和 bindings 直接在仓库维护，不参与反向收集。

```powershell
pwsh -File ./Backup-AgentConfig.ps1 -Check
pwsh -File ./Backup-AgentConfig.ps1
```

可通过 `-CodexRoot`、`-DshRoot`、`-SkillsRoot` 指定来源目录。默认使用 `CODEX_HOME`、`DSH_HOME`，未设置时分别为 `~/.codex/`、`~/.dsh/`；Skills 默认读取 `~/.agents/skills/`。

### 导出 DSH 提示词

[Backup-DshModelGuidance.ps1](Backup-DshModelGuidance.ps1) 导出“提示词”插件中已保存的正文和模型绑定，写入 `deepseek-harness/instructions/model-guidance.json`。需要安装 uv。

```powershell
pwsh -File ./Backup-DshModelGuidance.ps1 -Check
pwsh -File ./Backup-DshModelGuidance.ps1
```

使用 `-DshRoot` 可指定 DSH 配置目录。

### 生成 Codex 模型目录

[Prepare-ModelCatalog.ps1](codex/scripts/Prepare-ModelCatalog.ps1) 根据已下载的官方目录（没有时使用 Codex 模型缓存）和仓库提示词生成 `model-catalog.json`。

```powershell
pwsh -File ./codex/scripts/Prepare-ModelCatalog.ps1 -Check
pwsh -File ./codex/scripts/Prepare-ModelCatalog.ps1
```

在本仓库 `codex/instructions/base-instructions/` 中编辑提示词 Markdown 和 `bindings.json`，再运行脚本生成目录。可通过 `-CodexRoot` 指定 Codex 配置目录，或通过 `-SourceCatalog` 指定来源 JSON。

### 手动刷新官方模型目录

[Update-ModelCatalog.ps1](codex/scripts/Update-ModelCatalog.ps1) 使用本机 Codex 的 ChatGPT 登录凭据获取官方目录，再调用上述生成脚本。Service Desk V2 的“Codex 模型目录”维护任务调用同一入口；也可以直接执行：

```powershell
pwsh -NoProfile -File ./codex/scripts/Update-ModelCatalog.ps1
pwsh -NoProfile -File ./codex/scripts/Update-ModelCatalog.ps1 -Check
```

刷新直接读取仓库中的 Markdown 与 `bindings.json`，不在 `.codex` 保存它们的副本，按完整模型 ID 应用绑定；新增未绑定模型使用官方提示词，官方移除模型后其仓库绑定仍保留。日志列出新增、移除和更新的模型。`-Check` 获取并预览结果，不写入 Codex 配置目录。

脚本从 `CODEX_CLI_PATH`、Codex 配置中记录的 CLI 路径或 PATH 查找客户端，也可用 `-CodexExecutable` 指定。凭据过期时会提示在 Codex 重新登录，不自行续期或修改凭据。官方原始目录保存为 `official-model-catalog.json`，不覆盖客户端维护的 `models_cache.json`；生成结果写入 `model-catalog.json`，目录变化后需重启 Codex。已有自定义目录应通过 `model_catalog_json` 启用，脚本不修改 `config.toml`。

生成记录保存在仓库 `codex/.local/model-catalog.state.json`，由 `.gitignore` 排除。刷新按 Codex 目录互斥，先生成并校验再替换文件，失败时保留原目录；若生成结果被手动改过，先处理生成脚本报告的冲突。每次运行的源目录、生成结果与旧文件备份保留在本仓库 `.tmp/YYYYMMDD-refresh-model-catalog-*`，不包含登录凭据。操作为手动触发，不注册计划任务或后台服务。

## MCP 原型（已全部停用）

- [MiMo-MCP](mcp/MiMo-MCP/)：使用 MiMo 分析图片。
- [local-vision-mcp](mcp/local-vision-mcp/)：基于 Ollama 的视觉工具。
- [local-translate-mcp](mcp/local-translate-mcp/)：基于 Ollama 的翻译工具。

安装与配置见各项目 README。
