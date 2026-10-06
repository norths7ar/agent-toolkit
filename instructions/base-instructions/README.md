# 基础指令 override（进阶用法）

`AGENTS.md` 用于日常工作约定和项目规则；这里的基础指令通过 `model_instructions_file` 替换 Codex 的内置基础指令，用来调整更底层的协作方式。它不会因为放进 `~/.codex/` 就自动生效，需要配置引用。配置项见 [OpenAI 官方文档](https://developers.openai.com/codex/config-reference/#model_instructions_file)。

## 文件与版本

- `astra-base-instructions.md`：本次整理时本机实际引用的版本。
- `astra-base-instructions-v1.md`：保留的 Astra 旧版本，供比较或切换。
- `config.toml`：只展示自定义指令的 override 方式，不包括模型、provider、MCP、登录等其他用户设置项。

## 使用

1. 将选用的 Markdown 文件复制到本机 `~/.codex/`（设置了 `CODEX_HOME` 时改用该目录）。
2. 打开自己现有的 `config.toml`，在第一个 `[表名]` 之前的顶层位置添加或更新 `model_instructions_file`。参考同目录的示例，将路径改成本机实际绝对路径；Windows 可用 `/` 分隔路径。
3. 新开会话使用。切换版本时只需修改引用路径；取消 override 时删除该配置项，再新开会话。

示例不是完整配置，不要用它覆盖原有 `config.toml`。修改默认选用版本时，也更新仓库中的示例引用。

## 修改思路 2026-10-06

更广为人知的用户侧prompt注入方式，其实是全局或项目级别的 AGENTS.md 。我自己过去也是这么用的，但是在使用中曾经遇到过问题。

随着 GPT-6 Astra 发布而更新的那个版本的 Codex，它自带的 base-instructions 与我的预期相差甚远，而且有很多不合理之处。我的 AGENTS.md 在注入之后相当于再次和系统设定做搏斗，两侧拉扯，会让模型陷入困境。

所以我当时的选择是重写并override base-instructions。因为官方暴露的接口会一次性覆盖原本给不同模型用的不同的 base-instructions 文件，所以我现在被迫全用Astra，当然了好在用量还够。不清楚 GPT-6 包括 6.1系列模型表现如何。

后面从实现原理来说，我发现 base-instructions 实际上与 AGENTS.md 重复较多，所以我自己又做了二次分工，把人设、风格、行为之类的统一，只把本地专属内容留在了 AGENTS.md 里。其中有后缀的，如 `v1` 表示已 retire 的版本。无后缀的就是当前在用的版本。