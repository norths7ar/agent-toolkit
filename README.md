# agent-toolkit

个人 AI 工作流工具集，包括 Agent 指令、Skills、MCP 工具与 DSH 插件，同时保存本机指令和 Skills 的可迁移副本。

## 目录入口

- [codex/](codex/)：Codex 配置、指令和模型目录准备脚本。
- [AGENTS.project-template.md](AGENTS.project-template.md)：通用项目指令模板。
- [docs/](docs/)：使用文章和其他文档，按文档用途组织。
- [skills/](skills/)：Skills 及其配套资源，具体用途见各目录的 `SKILL.md`。
- [mcp/](mcp/)：MCP 工具源码，当前保留项目的状态见下方 MCP 小节。
- [deepseek-harness/](deepseek-harness/)：DSH 全局指令备份和本地插件，插件使用说明和潜在方向集中在下方。

## 收集本机配置

[Backup-AgentConfig.ps1](Backup-AgentConfig.ps1) 将本机指令和 Skills 收集到仓库：

```powershell
pwsh -File ./Backup-AgentConfig.ps1 -Check
pwsh -File ./Backup-AgentConfig.ps1
```

`-Check` 只显示差异。支持 `-SkillsRoot`、`-CodexRoot`、`-DshRoot` 指定源目录；Codex 默认目录优先取 `CODEX_HOME`，否则使用 `~/.codex/`；DSH 默认目录优先取 `DSH_HOME`，否则使用 `~/.dsh/`。

- 收集 Codex 全局 `AGENTS.md`、`model-prompts/` 下的 Markdown 和 `bindings.json`，以及 Codex 根目录下名含 `instructions` 的 Markdown 文件。同名正文优先收集 `model-prompts/` 中的版本；不收集生成的模型目录与状态记录。
- 将 DSH 全局 `AGENTS.md` 收集到 `deepseek-harness/instructions/AGENTS.md`；源文件不存在时跳过，保留已有备份。这个脚本不收集 DSH 的其他配置。

- 自动发现 Skills 源目录中含 `SKILL.md` 的各个子目录，复制其中的规则和配套资源。新增 Skill 无需维护名单。
- 延续原有过滤：跳过 Git、依赖和缓存目录、错误收集箱、`local` / `local-config.md`、`.env*` 与私钥文件。
- 仅更新有差异的文件，不自动删除仓库中已有的文件。项目模板、override 配置示例和 MCP 源码直接在仓库维护。

### DSH 模型提示词备份

在 DSH Desktop 的「提示词」界面编辑并保存后，从仓库根目录运行 `pwsh -File ./Backup-DshModelGuidance.ps1`。脚本用 uv 提供的隔离环境解析 Desktop 配置，只把提示词名称、正文和模型绑定导出到 `deepseek-harness/instructions/model-guidance.json`。加 `-Check` 可以预览是否需要更新；没有已保存的提示词配置时保留旧备份。脚本不修改本机配置，仓库副本也不参与 DSH 运行时加载。

## 换机取用

- `codex/instructions/AGENTS.md` 复制到 `~/.codex/AGENTS.md`。
- `deepseek-harness/instructions/AGENTS.md` 复制到 `~/.dsh/AGENTS.md`；若设置了 `DSH_HOME`，则复制到该目录。恢复后按新机器调整文件中的本机路径。
- 基础指令按 [override 使用说明](#codex-基础指令) 配置。
- `skills/` 中所需目录复制到 `~/.agents/skills/`；涉及本机路径的配置按对应 Skill 的说明填写。
- 项目模板从 `AGENTS.project-template.md` 取用。
- MCP 按各自 README 在新目录重建 uv 环境，并使用实际路径注册。
- 独立插件通过 submodule 记录版本，克隆后运行 `git submodule update --init --recursive` 获取对应源码。

## Codex 基础指令

`codex/instructions/AGENTS.md` 保存本机全局指令副本；`codex/instructions/base-instructions/` 保存各模型的基础指令和精确模型 ID 绑定。当前运行配置仍使用全局 `astra-base-instructions.md`；分模型正文与目录已准备到本机，但尚未启用或验证模型实际表现。

现行全局 override：将选用的正文复制到 `CODEX_HOME`（默认 `~/.codex`），在已有 `config.toml` 顶层设置 `model_instructions_file` 为本机文件绝对路径，然后新开聊天。目录中的 `config.toml` 只是单项示例，不要覆盖完整配置。切换版本时调整引用，取消时移除该项并新开聊天。

### 分模型目录准备

本机 `CODEX_HOME/model-prompts/` 是 Markdown 正文和 `bindings.json` 的日常编辑入口，默认位置为 `~/.codex/model-prompts/`。修改满意后用根目录备份脚本收集回仓库。

[Prepare-ModelCatalog.ps1](codex/scripts/Prepare-ModelCatalog.ps1) 读取本机 `models_cache.json`，保留其中全部模型，仅按绑定替换 `model_messages.instructions_template`，输出 `CODEX_HOME/model-catalog.json`。持续工作模式及其他元数据保持不变；缓存中的账号标识、etag 等外层信息不复制到产物。

```powershell
pwsh -File ./codex/scripts/Prepare-ModelCatalog.ps1 -Check
pwsh -File ./codex/scripts/Prepare-ModelCatalog.ps1
```

`-Check` 只预览，不写文件。可用 `-CodexRoot` 指定本机目录、`-SourceCatalog` 指定上游目录 JSON；默认不联网，使用已有缓存。首次运行只补齐缺失正文和绑定，同名旧正文优先从 Codex 根目录取用，否则使用仓库副本。后续运行保留本机正文和绑定，不用仓库文件覆盖。当前绑定覆盖目录中的 Astra、Sol、Terra、Luna 已知版本，同系列共享正文；新增模型需明确添加绑定，未绑定模型沿用官方指令。

脚本在 `model-prompts/.catalog-state.json` 保存上次生成的哈希。若产物被直接编辑，脚本停止覆盖并报告变化；先核对 JSON，将要保留的正文修改收回 Markdown，再把手工编辑的目录移到备份位置，重新运行。同一正文绑定多个模型时，先协调这些模型的不同改动。上游缓存更新后，重新运行即可合成新元数据和本机正文。

脚本不修改 `config.toml` 或官方缓存，也不启用产物。未来接入时需设置 `model_catalog_json` 为本机产物路径，并移除优先级更高的 `model_instructions_file`；已有 custom 指令聊天不会自动迁移。

## MCP

- [MiMo-MCP](mcp/MiMo-MCP/)：已卸载停用的云端 MiMo 视觉分析原型，保留源码供参考。
- [local-vision-mcp](mcp/local-vision-mcp/)、[local-translate-mcp](mcp/local-translate-mcp/)：已停用的 Ollama 本地工具，保留源码供参考。

## DSH 本地插件

插件界面开发遵循共享的[前端设计约定](deepseek-harness/docs/frontend-design.md)，沿用 DSH 的组件与交互语言。

开发中的[第二意见插件](deepseek-harness/plugins/dsh-second-opinion/README.md)支持在回复处邀请其他模型，以可折叠的 Markdown 卡片预览，点击“继续聊”才创建正式分支，并提供默认提示词设置。已适配 DSH 0.2.2-rc.3，要求原会话已有运行实例，不主动恢复冷会话。已通过离线运行库验证，实际窗口与模型菜单加载正常，真实 Provider 生成流程待实际使用验证。

定制增强主要放在 DeepSeek Harness（DSH），交互优先考虑 GUI。优先复用内置能力和独立的小实现；原先两个第三方大包已删除，不再依赖其中的 `@weibaohui/skills-management`。没有独立仓库的插件留在本仓库，未来独立发布的插件再以 submodule 挂载。

本机 DSH 安装于 `C:\Users\jnkyl\AppData\Local\Programs\DeepSeek Harness`，配置位于 `~/.dsh`。OCX 是模型 API 代理。开发时不擅自重启两者，不修改原始聊天记录；增改测试前先征得同意。

### Claude thinking 保护

[dsh-claude-replay-guard](deepseek-harness/plugins/dsh-claude-replay-guard/) 仅处理 `opencodex` provider 下的 Claude 路由。当 system、工具列表或此前历史变化导致旧 thinking 签名失效时，在出站请求副本中有条件移除失效 thinking 和对应 replay 数据，保留正文、工具调用及结果，不修改原始会话或 OCX。

插件无依赖和构建步骤，可在 `~/.dsh/profiles/desktop/cordis.patch.yml` 中加载：

```yaml
- insert:
    - id: local-claude-replay-guard
      name: 'file:///E:/Projects/agent-workspace/agent-toolkit/deepseek-harness/plugins/dsh-claude-replay-guard/index.js'
      config: {}
```

DSH 监听 profile patch，可不重启加载该项；修改 JavaScript 不保证热重载。停用时给该项设置 `disabled: true`。保留 `~/.dsh/claude-replay-guard/` 中的哈希状态，以免重新启用后遗忘失效签名。插件目录自带的 patch 是默认停用的包安装示例，与上面的直接文件加载方式不同。

已做离线验证并曾确认 active；2026-10-16 仍看到加载配置，当前运行状态需按需查询。插件不自动丢弃安装前未知的签名，因此不能识别所有发生在安装前的失效情况。

### 模型行为指南

本插件独立维护于 `norths7ar/dsh-model-guidance`，此处目录是 submodule。本工作区的开发与 DSH 安装引用指向 `../deepseek-harness/dsh-model-guidance`；此处 checkout 只记录选定提交，更新时先提交独立仓库，再更新 submodule 指针。推送父仓库前，应先将对应插件提交推送到插件的两个远端。

[dsh-model-guidance](deepseek-harness/plugins/dsh-model-guidance/README.md) 按提供商 ID 和模型 ID 精确绑定提示词，一份提示词可供多个模型使用。通过侧栏管理提示词、按需选择模型，支持单条保存和保存全部。界面支持中英文并沿用 DSH 组件；配置 ID 保持为 `local-model-guidance`。

当前核对宿主为 DSH Desktop **0.2.2-rc.3**。插件仅在标准模式替换角色前缀，子智能体按自己的模式判断；未绑定或正文为空时沿用默认内容。支持 `{{model}}` 和 `{{provider}}` 占位符。已发布至 GitHub，采用 MIT；安装、使用、生效范围与开发命令见[插件文档](deepseek-harness/plugins/dsh-model-guidance/README.md)。

### 任务通知

[dsh-task-notifications](deepseek-harness/plugins/dsh-task-notifications/README.md) 独立维护于 `norths7ar/dsh-task-notifications`，此处目录是 submodule。开发与本机 DSH 安装引用指向 `../deepseek-harness/dsh-task-notifications`。插件提供任务完成、失败、等待审批和需要回答问题四类系统通知；主动停止和子任务结束不单独提醒。

通过 **设置 → 任务通知** 调整系统通知和四类事件，默认全部开启，更改后自动保存。安装、使用和开发命令见[插件文档](deepseek-harness/plugins/dsh-task-notifications/README.md)。

任一前台窗口正在查看事件所属会话时不提醒；在前台查看其他页面时显示页内提醒；应用在后台时发送系统通知。多个窗口通过宿主统一认领，同一事件只投递一次。点击系统通知可唤起 DSH 并打开对应会话，页内提醒也可跳转。连续运行的任务在运行结束后，根据最后一轮的结束原因通知。重新连接不补发旧事件。

当前适配 DSH **0.2.2-rc.3**。通知使用最长 3 秒的有界请求，正常请求轮转通过游标衔接，避免永久连接阻塞桌面更新。离线验证覆盖主会话筛选、跨窗口去重、审批失效和连接生命周期；系统通知、点击唤起和会话跳转已在本机验证。GitHub 链接已通过隔离 profile 的 DSH 安装与加载验证。安装后可点击 **测试提醒**，在 5 秒内切到其他应用观察通知。

### 最新消息撤回与修改

[dsh-latest-message-edit](deepseek-harness/plugins/dsh-latest-message-edit/) 只处理最新一条用户消息，入口放在消息旁，与 DSH 的复制按钮并排。点击后先停止本轮、等待已发出的工具收尾，再将文字带回输入框修改。更早的消息继续使用 Fork；待发送队列沿用 DSH 自带的编辑和移除。

尚未发起操作时，发送修改会将旧请求和回复从后续模型上下文中撤回，仅保留简短的撤回标记；已有操作时，保留原请求、调用和结果，并明确告知模型按更正后的要求继续。两种情况都只追加会话记录，不删改原始日志，不回滚文件或其他操作。取消修改恢复原消息显示，不恢复已停止的任务。第一版修改正文、保留原消息附件，不提供附件增删；输入框原有的草稿会暂存，并在修改完成或取消后恢复。 已适配 0.2.2-rc.1 的引用草稿结构与提交分隔，恢复时保留引用卡片。

在 DSH 的 **插件 → 添加插件** 中输入本地目录 `E:\Projects\agent-workspace\agent-toolkit\deepseek-harness\plugins\dsh-latest-message-edit`，安装并启用。插件无额外依赖和构建步骤。当前适配 DSH **0.2.2-rc.3** 的运行时主会话判断；消息旁按钮使用局部 DOM 适配，DSH 更新消息布局后可能需要调整。

已在 rc.3 实际界面验证修改入口、原文载入输入框和取消后恢复消息及原草稿；离线运行库验证状态读取不改变原记录。真实发送仍需检查纯文字生成中撤回、工具执行后修改、工具尚未返回时停止及切换会话后的草稿保留。发送后确认模型使用新要求；已有操作的情况应保留工具记录，不能表现得像此前从未执行。
