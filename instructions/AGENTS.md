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
