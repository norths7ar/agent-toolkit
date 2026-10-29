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
- 将 DSH 全局 `AGENTS.md` 收集到 `deepseek-harness/instructions/AGENTS.md`；源文件不存在时跳过，保留已有备份。不收集 DSH 凭据、聊天记录、运行状态、插件依赖或其他配置。
- 自动发现 Skills 源目录中含 `SKILL.md` 的各个子目录，复制其中的规则和配套资源。新增 Skill 无需维护名单。
- 延续原有过滤：跳过 Git、依赖和缓存目录、错误收集箱、`local` / `local-config.md`、`.env*` 与私钥文件。
- 仅更新有差异的文件，不自动删除仓库中已有的文件。项目模板、override 配置示例和 MCP 源码直接在仓库维护。

## 换机取用

- `codex/instructions/AGENTS.md` 复制到 `~/.codex/AGENTS.md`。
- `deepseek-harness/instructions/AGENTS.md` 复制到 `~/.dsh/AGENTS.md`；若设置了 `DSH_HOME`，则复制到该目录。恢复后按新机器调整文件中的本机路径。
- 基础指令按 [override 使用说明](#codex-基础指令) 配置。
- `skills/` 中所需目录复制到 `~/.agents/skills/`；涉及本机路径的配置按对应 Skill 的说明填写。
- 项目模板从 `AGENTS.project-template.md` 取用。
- MCP 按各自 README 在新目录重建 uv 环境，并使用实际路径注册。

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

### 按模型切换行为指导

[dsh-model-guidance](deepseek-harness/plugins/dsh-model-guidance/) 按 `provider ID + model ID` 精确绑定行为指导，一份正文可供多个模型使用。设置页支持新增、编辑、删除和绑定模型，正文与绑定一起保存。正文由用户填写；未绑定或正文为空时沿用 DSH 原有角色前缀。

插件只替换 `deployment:persona-prefix`，保留模式、工具、AGENTS 和 Skills 的指导。正文按原文使用，不展开模板变量；完整提示词覆盖的 minimal preset 保持原样。模型选择和正文保存均在下一次提示词组装时生效，已组装的步骤不变，不必等到下一条用户消息。不提供任务预设或自动模型家族匹配。

在 DSH 左侧打开 **插件 → 添加插件**，输入本地插件目录 `E:\Projects\agent-workspace\agent-toolkit\deepseek-harness\plugins\dsh-model-guidance`，安装后选择启用。安装包装包含 bundle patch 和中文显示信息；前端复用 DSH 的 React、主面板、侧栏和模型目录，无构建步骤。通过左侧导航的 **模型行为指南** 打开独立编辑页面，不再通过设置弹窗进入。

已有旧版直接加载项时，先安装但暂不启用。将 `~/.dsh/profiles/desktop/cordis.patch.yml` 中该插件的旧 `insert` 项改为下方顶层配置覆盖，原有 `config` 内容完整保留，只去掉旧 `file:` 加载路径；再从插件页启用。这样仍使用同一配置 ID，不会重复加载或丢失正文和绑定。若旧 `insert` 还包含其他插件，只移出本插件项。

```yaml
- id: local-model-guidance
  config: {} # 换成原项完整的 config；已有内容不要清空。
```

插件使用固定配置 ID `local-model-guidance`。配置由 DSH Settings 保存到 profile，仓库不预填提示词。已选模型集中显示为可移除卡片，搜索仅按名称、ID 和 provider 过滤候选，绑定仍是精确匹配。模型已绑定其他指南时先解除旧绑定；目录里暂时消失的模型仍可解除绑定。

页面底部统一提供“放弃修改”和“应用”。切换到聊天或其他主页面后再回来，未应用的草稿仍保留；只有应用才写入配置，刷新应用或卸载插件不保证保留草稿。仅开发或继续直接加载时，在插件目录运行 `npm ci --ignore-scripts` 准备依赖；不同时启用直接加载与 bundle 加载。

接口依据为本机 DSH **0.2.1-rc.2**。本机 GUI 加载、保存与切换效果由用户验证：添加指南并填写正文、绑定模型、保存后重新打开确认，再分别选择已绑定和未绑定模型检查行为指导是否随之生效。

### 任务通知

[dsh-task-notifications](deepseek-harness/plugins/dsh-task-notifications/) 提供系统通知和 Windows 任务栏闪烁，区分任务完成、失败、等待审批和需要回答问题。主动停止和子任务结束不单独提醒；完成与失败依据回合结束原因，不将运行转为空闲直接视为成功。

在 DSH 的 **插件 → 添加插件** 中输入本地目录 `E:\Projects\agent-workspace\agent-toolkit\deepseek-harness\plugins\dsh-task-notifications`，安装并启用。通过 **设置 → 任务通知** 调整两种提醒方式和四类事件，默认全部开启，更改后自动保存。插件无构建步骤；本地开发可运行 `npm ci --ignore-scripts` 准备依赖。

前台查看事件所属会话时不提醒；在前台查看其他页面时发送系统通知；应用在后台时同时提示任务栏。切回 DSH 后停止闪烁。重新连接不补发旧事件，通知不承诺点击唤起或定位会话。Windows 辅助调用使用 PowerShell 7，不修改 DSH 本体、快捷方式或通知注册。

系统通知与任务栏闪烁已分别在本机验证可用，插件整体接入尚待用户验证。安装后点击 **测试提醒**，在 5 秒内切到其他应用观察通知和任务栏，再切回确认闪烁停止；随后用真实任务检查完成、失败和待处理提醒，以及前台当前会话的免打扰行为。接口依据为 DSH **0.2.1-rc.2**。

### 最新消息撤回与修改

[dsh-latest-message-edit](deepseek-harness/plugins/dsh-latest-message-edit/) 只处理最新一条用户消息，入口放在消息旁，与 DSH 的复制按钮并排。点击后先停止本轮、等待已发出的工具收尾，再将文字带回输入框修改。更早的消息继续使用 Fork；待发送队列沿用 DSH 自带的编辑和移除。

尚未发起操作时，发送修改会将旧请求和回复从后续模型上下文中撤回，仅保留简短的撤回标记；已有操作时，保留原请求、调用和结果，并明确告知模型按更正后的要求继续。两种情况都只追加会话记录，不删改原始日志，不回滚文件或其他操作。取消修改恢复原消息显示，不恢复已停止的任务。第一版修改正文、保留原消息附件，不提供附件增删；输入框原有的草稿会暂存，并在修改完成或取消后恢复。

在 DSH 的 **插件 → 添加插件** 中输入本地目录 `E:\Projects\agent-workspace\agent-toolkit\deepseek-harness\plugins\dsh-latest-message-edit`，安装并启用。插件无额外依赖和构建步骤。接口依据为 DSH **0.2.1-rc.2**；消息旁按钮使用局部 DOM 适配，DSH 更新消息布局后可能需要调整。

本机验证由用户操作：分别检查纯文字生成中撤回、工具执行后修改、工具尚未返回时停止，以及取消修改与切换会话后的草稿保留。发送后确认模型使用新要求；已有操作的情况应保留工具记录，不能表现得像此前从未执行。实际运行效果尚未验证。
