# agent-toolkit

个人 AI 工作流工具集，包括 Agent 指令、Skills、MCP 工具与 DSH 插件，同时保存本机指令和 Skills 的可迁移副本。

## 目录入口

- [instructions/](instructions/)：Agent 指令、项目模板和本机指令备份；基础指令的配置方式见[使用说明](instructions/base-instructions/README.md)。
- [skills/](skills/)：Skills 及其配套资源，具体用途见各目录的 `SKILL.md`。
- [mcp/](mcp/)：MCP 工具源码，当前保留项目的状态见下方 MCP 小节。
- [deepseek-harness/](deepseek-harness/)：DSH 本地插件，使用说明和潜在方向集中在下方。

## 收集本机配置

[Backup-AgentConfig.ps1](Backup-AgentConfig.ps1) 将本机指令和 Skills 收集到仓库：

```powershell
pwsh -File ./Backup-AgentConfig.ps1 -Check
pwsh -File ./Backup-AgentConfig.ps1
```

`-Check` 只显示差异。支持 `-SkillsRoot`、`-CodexRoot`、`-DshRoot` 指定源目录；Codex 默认目录优先取 `CODEX_HOME`，否则使用 `~/.codex/`；DSH 默认目录优先取 `DSH_HOME`，否则使用 `~/.dsh/`。

- 收集 Codex 全局 `AGENTS.md`，以及 Codex 目录下名含 `instructions` 的 Markdown 文件，包括保留的旧版本。
- 将 DSH 全局 `AGENTS.md` 收集到 `instructions/dsh/AGENTS.md`；源文件不存在时跳过，保留已有备份。不收集 DSH 凭据、聊天记录、运行状态、插件依赖或其他配置。
- 自动发现 Skills 源目录中含 `SKILL.md` 的各个子目录，复制其中的规则和配套资源。新增 Skill 无需维护名单。
- 延续原有过滤：跳过 Git、依赖和缓存目录、错误收集箱、`local` / `local-config.md`、`.env*` 与私钥文件。
- 仅更新有差异的文件，不自动删除仓库中已有的文件。项目模板、override 配置示例和 MCP 源码直接在仓库维护。

## 换机取用

- `instructions/AGENTS.md` 复制到 `~/.codex/AGENTS.md`。
- `instructions/dsh/AGENTS.md` 复制到 `~/.dsh/AGENTS.md`；若设置了 `DSH_HOME`，则复制到该目录。恢复后按新机器调整文件中的本机路径。
- 基础指令按 [override 使用说明](instructions/base-instructions/README.md) 配置。
- `skills/` 中所需目录复制到 `~/.agents/skills/`；涉及本机路径的配置按对应 Skill 的说明填写。
- 项目模板从 `instructions/AGENTS.project-template.md` 取用。
- MCP 按各自 README 在新目录重建 uv 环境，并使用实际路径注册。

## MCP

- [MiMo-MCP](mcp/MiMo-MCP/)：已卸载停用的云端 MiMo 视觉分析原型，保留源码供参考。
- [local-vision-mcp](mcp/local-vision-mcp/)、[local-translate-mcp](mcp/local-translate-mcp/)：已停用的 Ollama 本地工具，保留源码供参考。

## DSH 本地插件

定制增强主要放在 DeepSeek Harness（DSH），交互优先考虑 GUI。优先复用内置能力和独立的小实现；原先两个第三方大包已删除，不再依赖其中的 `@weibaohui/skills-management`。没有独立仓库的插件留在本仓库，未来独立发布的插件再以 submodule 挂载。

本机 DSH 安装于 `C:\Users\jnkyl\AppData\Local\Programs\DeepSeek Harness`，配置位于 `~/.dsh`。OCX 是模型 API 代理。开发时不擅自重启两者，不修改原始聊天记录；增改测试前先征得同意。

### 已完成：Claude thinking 回放保护

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

### 任务通知（待本机 GUI 验证）

[dsh-task-notifications](deepseek-harness/plugins/dsh-task-notifications/) 提供系统通知和 Windows 任务栏闪烁，区分任务完成、失败、等待审批和需要回答问题。主动停止和子任务结束不单独提醒；完成与失败依据回合结束原因，不将运行转为空闲直接视为成功。

在 DSH 的 **插件 → 添加插件** 中输入本地目录 `E:\Projects\agent-workspace\agent-toolkit\deepseek-harness\plugins\dsh-task-notifications`，安装并启用。通过 **设置 → 任务通知** 调整两种提醒方式和四类事件，默认全部开启，更改后自动保存。插件无构建步骤；本地开发可运行 `npm ci --ignore-scripts` 准备依赖。

前台查看事件所属会话时不提醒；在前台查看其他页面时发送系统通知；应用在后台时同时提示任务栏。切回 DSH 后停止闪烁。重新连接不补发旧事件，通知不承诺点击唤起或定位会话。Windows 辅助调用使用 PowerShell 7，不修改 DSH 本体、快捷方式或通知注册。

系统通知与任务栏闪烁已分别在本机验证可用，插件整体接入尚待用户验证。安装后点击 **测试提醒**，在 5 秒内切到其他应用观察通知和任务栏，再切回确认闪烁停止；随后用真实任务检查完成、失败和待处理提醒，以及前台当前会话的免打扰行为。接口依据为 DSH **0.2.1-rc.2**。

### 潜在工作方向

以下是需求与候选方向，尚未确定开发顺序。实现依据为 **2026-10-16 对 DSH `0.2.0-rc.2` 安装包代码和随包文档的核查**，未逐项验证运行中的 GUI；升级后需复查相关接口。

**Codex 历史材料**

- 需求：GUI 可展示、搜索和定位完整历史；模型侧仅接收材料简介、按需检索片段或用户选中的几轮，明确区分已导入材料和本轮上下文。可先做关键词检索、按轮读取，配合 Skill 使用材料工具，不要求向量 RAG。其他平台的 thinking、签名和工具记录不作为 DSH 原生续接状态。
- 已核实：前端支持插件注册右侧标签页和独立主面板，展示材料不必写入原生会话。
- 待定：布局、导入格式、索引、检索工具及手动选入流程。

**最新消息撤回与编辑**

- 需求：历史消息继续用 Fork；最新消息尚未触发操作时撤回到输入框，已有操作时停止后就地编辑，提示并保留已有操作，让模型结合这些操作继续处理。
- 已核实：待发送队列支持编辑和移除，但不覆盖已消费消息。取消请求被接受后仍需等待已启动工具收尾，不等于工具已经停止。
- 待定：“尚未操作”的边界、工具已发出但未返回时的处理，以及更正内容如何与已有操作一起提供给模型。未确认 Codex 是否采用同样逻辑。

**本地 Skill 管理**

- 范围：先做本地管理，不做市场或联网；候选功能为名称、说明、来源、正文查看和打开编辑，导入可选。
- 已核实：DSH 已发现用户级及项目级 `.agents/skills`、`.dsh/skills`、自定义目录和内置 Skills，实际会话也已使用共享 Skills，无需重做发现或复制导入。
- 待定：最小 GUI 范围及是否提供启停。若做启停，先检查 DSH 筛选配置，不通过搬走共享文件影响 Codex。

**上下文可视化**

- 需求方向：近似展示占用和组成即可。
- 已核实：内置 `dsh-token-meter` 和 GUI 已提供近似占用率及系统提示词、工具、对话三类组成。
- 待定：先查看现有界面是否满足用途，再决定补什么，不重建统计系统。

### 已有能力与暂缓事项

- 思考档位已有 GUI→会话→适配器的实现，无需重做；与 OCX 模型目录实时同步的机制未确认。
- 侧边提问和引用追问暂用分支替代；历史时间线、项目级长期记忆暂缓。
- 当前不需要预算上限或 MCP 图形管理；余额查询取决于可用接口，PTC 先评估收益。
