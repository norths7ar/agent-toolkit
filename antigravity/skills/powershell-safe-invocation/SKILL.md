---
name: powershell-safe-invocation
description: Use for PowerShell scripts, complex native arguments, process or filesystem mutations, and shell invocation troubleshooting. Skip simple read-only commands.
---

# PowerShell Safe Invocation

## Before Execution

Use PowerShell 7 through `pwsh.exe`; `powershell.exe` is Windows PowerShell 5.1. Select the execution tool's shell directly when supported rather than nesting shells. If uncertain, check `$PSVersionTable.PSVersion` and `$PSNativeCommandArgumentPassing` in the actual execution shell.

Before submitting a command, briefly check shell syntax, argument boundaries, variable expansion, and path handling. This is an internal check, not a user-facing checklist.

- No Bash heredocs (`python - <<'PY'`), Bash-style `\"` escaping, or `%NAME%` environment expansion. Use `$env:NAME`.
- Use single quotes for literal text and paths; double quotes only for intended expansion. Avoid backtick line continuation.
- Group computed parameter values: `Select-Object -Index (100..120)`.
- Do not pipe directly from `foreach (...) { ... }`; assign its output or use `ForEach-Object`.
- Do not reuse automatic or system variables such as `$args` or `$HOME` for task data.

## Invocation and Errors

For simple, routine CLI invocations without complex quoting or spaces in executable paths, prefer direct literal invocations (e.g., `git -C OpenFic status`) so host prefix-matching auto-approval continues to work smoothly. When executable paths contain spaces, arguments are constructed dynamically, or quoting/escaping is nontrivial, invoke native executables with `&` and an argument array, never a constructed command string:

```powershell
$exe = 'C:\Path With Spaces\tool.exe'
$nativeArgs = @('--input', 'C:\Data Folder\input.json')
& $exe @nativeArgs
$exitCode = $LASTEXITCODE
```

Capture `$LASTEXITCODE` immediately and interpret it using that tool's exit-code contract; nonzero does not universally mean failure. For PowerShell cmdlets, use `-ErrorAction Stop` or an appropriately scoped `$ErrorActionPreference = 'Stop'` when failure must stop dependent work, not `$LASTEXITCODE`.

Use hashtable splatting for complex cmdlet calls. Prefer `-LiteralPath` for concrete paths when supported; `New-Item` uses `-Path`. Check `Get-Command <name> -Syntax` when parameters or versions are uncertain.

Execute ordinary multiline PowerShell directly in a known shell. Pipelines, regular expressions, and Unicode paths alone do not require a temporary file. Use a temporary `.ps1` with `pwsh.exe -NoLogo -NoProfile -NonInteractive -File ...` when crossing parsers, managing fragile nested quoting, or reusing substantial code. Keep temporary files in the task's scratch directory.

Avoid an extra `cmd.exe /c` layer unless cmd semantics are required. Do not use `Invoke-Expression` to launch programs or evaluate generated command strings. Its narrow exception is intentionally executing trusted PowerShell source when no structured alternative fits; see the reference. Do not add `-ExecutionPolicy Bypass` without a demonstrated, permitted need.

Use `Start-Process` for detached launch, elevation, or special window/shell behavior. Background helpers should use hidden windows unless the user requests otherwise. Its `-ArgumentList` flattens arguments; use `ProcessStartInfo.ArgumentList` for exact boundaries. When redirecting both stdout and stderr, drain them concurrently; see reference section 9.

## Text and Files

- Use objects and `ConvertTo-Json` for generated JSON. Use single-quoted here-strings for literal multiline text, with delimiters on their own lines.
- Preserve existing encoding and line endings when editing files. Specify the required encoding for new text, usually UTF-8. Use byte APIs for binary data.
- Do not adjust console encodings without a confirmed mismatch; `$OutputEncoding` controls text sent to native programs.
- Before recursive deletion or moving, resolve absolute root and target paths, verify the target is inside the intended boundary, and reject empty, root-level, or unexpected targets. Keep filesystem mutations in one shell.

## Troubleshooting

When a PowerShell syntax, quoting, argument-passing, shell-version, or encoding failure occurs, inspect the actual shell and simplify the failing invocation before retrying. Do not repeat the same quoting pattern blindly.

For detailed examples and uncommon cases, consult the relevant section of [reference.md](reference.md): argument modes (1–3), syntax (4–7), processes and streams (8–9), cmd/evaluation (10–11), paths (12), encoding (13), and diagnostics (16).
