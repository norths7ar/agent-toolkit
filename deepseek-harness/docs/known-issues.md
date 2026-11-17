# DeepSeek Harness 已知软件问题

记录 DSH 的已知故障、原因和修复方向，供维护与上游反馈使用。最后核实：2026-11-17。

调查环境为 Windows 11 Pro，安装包内 `@deepseek-ai/dsh-sandbox-local`、`@deepseek-ai/dsh-sandbox-windows-acl` 版本均为 `0.2.2-rc.3`。

## 1. 工作区缺少 WRITE_OWNER 时，shell 沙箱初始化失败

**状态：已确认。**

`sandbox-local` 的 Windows 后端使用 `windows-acl`。在 `workspace-write` 模式下，启动 shell 子进程前会对工作区执行 `grantWrite`，同时设置 DACL 和低完整性标签（Low mandatory label）。因此，即使具体命令只读，也可能在执行命令前因授权初始化失败而被拒绝。

修改 DACL 需要 `WRITE_DAC`，设置完整性标签还需要 `WRITE_OWNER`。目录所有者隐含的修改 DACL 权限不包含 `WRITE_OWNER`，所以即使用户拥有目录、可以正常读写文件，也可能无法完成这一步初始化。

本机修复报告确认：工作区根目录原先 `WRITE_DAC=true`、`WRITE_OWNER=false`，为当前用户补上 FullControl 后两项均为 true。FullControl 能解决根目录初始化，但包含了超出此处缺失项的权限；仅补 `WRITE_OWNER` 是更小的权限调整。

## 2. 授权未传播到已有子目录，DSH 仍判定成功

**状态：已通过独立目录对照实验复现；实际项目尚未完成整树修复。**

### 现象与原因

在 OpenCodex 审查任务中，多个使用 `workspace-write` 的子代理无法通过 shell 写入 `opencodex/.tmp`。其中一个子代理也无法写入工作区 `.tmp`，但能在工作区根目录新建目录并写入。

检查发现：工作区根目录已有 DSH 的 capability ACE 和低完整性标签；已有子目录缺少这些项，而后来新建的目录能正常继承。已有子目录未关闭 DACL 继承，但当前用户缺少它们的 `WRITE_OWNER`。

DSH 使用 `SetNamedSecurityInfoW`，一次提交 `DACL_SECURITY_INFORMATION | LABEL_SECURITY_INFORMATION`（`0x14`）。在本机复现中，现有子目录缺少 `WRITE_OWNER` 时，这次组合更新没有传播到该子目录，连同 DACL 更新一起未生效；API 却仍返回根目录操作成功。

### 对照实验

独立实验先创建子目录，再给根目录补权限，最后使用与 DSH 相同的 Windows API、标志和等效授权条目，复现授权传播过程。

| 条件 | API 返回值 | 已有子目录结果 |
| --- | --- | --- |
| 子目录有 WRITE_DAC、无 WRITE_OWNER；同时设置 DACL 和标签 | 0（成功） | DACL 和标签均未传播 |
| 子目录额外有 WRITE_OWNER；同时设置 DACL 和标签 | 0（成功） | DACL 和标签均成功传播 |
| 子目录无 WRITE_OWNER；只设置 DACL | 0（成功） | DACL 成功传播；未请求设置标签 |

各组在根目录更新后新建的子目录，都继承了根目录已设置的对应权限和标签。实验说明，已有子目录缺少 `WRITE_OWNER` 足以造成“新目录能写、旧目录不能写”的现象。

### DSH 未发现失败，后续还会跳过重试

`grantWrite` 只检查根目录是否已有预期的 capability allow ACE、Everyone deny ACE 和低完整性标签；满足后直接返回。设置 API 返回成功后，也没有核实子项是否真正获得权限。

因此，首次授权会漏报子目录传播失败；后续即使补好了子目录的权限，也可能因根目录检查通过而跳过重新授权。

修复需要补足相关现有子项的 `WRITE_OWNER`，重新下发授权，并验证子项的 DACL 和低完整性标签。DSH 也需要在授权后检查传播结果，并支持修复根目录授权已存在、子目录授权缺失的状态。仅将 DACL 与标签分开设置只能解决 DACL 的传播，低完整性进程写入所需的标签仍需另行设置成功。

## 3. ACL 修复脚本缺少独立诊断和分项修复

**状态：脚本行为与本次执行结果已确认；应用包权限冲突的底层原因未确认。**

`diagnose-windows-sandbox-acl.ps1` 将检查和修复放在同一流程中，没有独立的只检查模式或逐项选择修复开关。它会检查目标与祖先、进行有数量上限的子树扫描，并在 `AllowRoot` 范围内执行权限修复、备份及失败回滚。

2026-11-16 的工作区修复只为根目录上的当前用户增加了不继承的 FullControl。根目录初始化随后成功，但已有子目录仍缺少 `WRITE_OWNER`，传播问题继续存在。脚本的子树扫描未能保证这次修复覆盖实际受影响的目录。

脚本还会移除显式的应用包 allow ACE（`S-1-15-2-*`，排除指定的通用组），保留 deny ACE。安装包说明记录了其他应用包 ACE 与低权限 token 访问失败之间的实验关联，但底层原因尚未确认，脚本也未逐条验证被删除的 ACE 是否导致当前故障。本次工作区修复没有触发这项清理。

后续改进应提供独立诊断和可选择的修复项，并分别报告缺失权限、传播失败和应用包 ACE 的疑似影响。

## 相关实现限制

### shell 与直接文件工具使用不同沙箱

shell 子进程使用 Windows ACL/低权限 token 路径，直接文件工具另走 `dsh-fs-sandbox`。本次会话中出现了直接 `write` 工具能创建文件、shell 却不能修改对应位置的情况。

排查时应分别记录具体工具、工作目录和 sandbox policy，并单独验证 shell 的访问结果。

### Windows 后端未接入 MXC

本机 `sandbox-local` 的 Windows 后端链固定为 `windows-acl`，没有内置 MXC 后端。同机 Codex 日志显示实际使用 MXC，因此两者在同一工作区的沙箱行为不同。

DSH 的 shell executor 通过 `ctx.sandbox` 使用抽象 `SandboxProvider` 服务。该接口提供了编写替代 provider 的可能，具体插件接入方式尚未验证。

`sandbox-local` 的 `runnerCommand` 使用 bwrap 兼容参数，接入 MXC 需要适配调用约定。若直接在现有 `sandbox-local` 后端链中增加 MXC，则需要修改该包或推动上游支持。

## 源码与证据定位

本机安装包：`C:/Users/jnkyl/AppData/Local/Programs/DeepSeek Harness/resources/app.asar`。包内主要调查位置：

- `dsh/node_modules/@deepseek-ai/dsh-sandbox-windows-acl/src/acl.ts`：`grantWrite`、根目录检查、组合设置 DACL 和标签的调用。
- 同包 `src/grant.ts`、`src/token.ts`、`README.md`：授权生命周期、token 与已知 ACL 行为。
- `dsh/node_modules/@deepseek-ai/dsh-sandbox-local/src/index.ts`：Windows 后端选择及 runner 接口。
- `dsh/node_modules/@deepseek-ai/dsh-sandbox/src/index.ts`：`SandboxProvider` 抽象接口。

工作区修复报告与备份：`E:/Projects/agent-workspace-acl-recovery-20261116/`。
