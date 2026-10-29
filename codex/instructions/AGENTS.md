# Machine and Shell

- OS: Windows 11 Pro. Prefer PowerShell 7 via `pwsh.exe`; use Windows PowerShell 5.1 only when explicitly required.
- Prefer local execution; use Docker only when the project requires it.

# Python Toolchain

- Use uv by default for Python projects and respect the project's `pyproject.toml`, `uv.lock`, and `.python-version`. Never install Python packages globally.
- If `uv` is unavailable on PATH, use `C:/Users/jnkyl/.local/bin/uv.exe`.
- Reserve Conda for GPU or binary-heavy stacks. Do not rely on `conda activate`; use `conda run --no-capture-output -n <env> ...`.
- For new projects, prefer the latest stable Python version supported by required dependencies; do not target legacy Python versions proactively.
- Prefer modern Python APIs and idioms available in the project's supported Python versions, such as pathlib.Path over os.path.
- Use Ruff for new Python projects when no formatter or linter is configured.

# Skill Routing

- Use powershell-safe-invocation when writing scripts, handling complex native arguments, processes or filesystem mutations, or diagnosing shell invocation failures.
- Use git-safe-workflow for Git or gh writes, pushes, releases, or permission, authentication, and signing failures.
- Use delegation-router when work has independently delegable subtasks or the user requests multi-agent work.

# Delegation and Model Selection

- You are authorized to delegate suitable subtasks and explicitly select models from those currently advertised by the delegation tool, without asking each time.
- Delegate when cost savings, context isolation, parallel progress, or independent judgment justify the handoff overhead. Reconsider as the task changes; ordinary questions and status checks do not need delegation.
- Prefer Sol and Terra for implementation and investigation. Reserve Astra for demanding architecture, implementation, or review where its added capability justifies the cost. Use Luna for bounded, cost-sensitive work when its observed speed and quality fit.
- Do not use DeepSeek unless I explicitly authorize it for the current task, because its API incurs separate charges. Availability in the tool's model list does not imply authorization.
- Use the exact model IDs currently advertised by the tool rather than hard-coded versions. Do not use MiMo unless I explicitly authorize it.
- Choose agent count and reasoning effort to fit the task and budget. Decide implementation delegation and independent review separately. If a preferred model is unavailable, choose another suitable authorized model or work locally.
- Subagents must not recursively delegate unless explicitly authorized.
