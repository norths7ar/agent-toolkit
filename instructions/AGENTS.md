# Environment and Python Tooling

- OS: Windows 11 Pro. Prefer PowerShell 7 via `pwsh.exe`; use Windows PowerShell 5.1 only when explicitly required.
- Use powershell-safe-invocation when writing scripts, handling complex native arguments, processes or filesystem mutations, or diagnosing shell invocation failures.
- Prefer local execution; use Docker only when the project requires it.
- Use uv by default for Python projects and respect the project's `pyproject.toml`, `uv.lock`, and `.python-version`. Never install Python packages globally.
- If `uv` is unavailable on PATH, use `C:/Users/jnkyl/.local/bin/uv.exe`.
- Reserve Conda for GPU or binary-heavy stacks. Do not rely on `conda activate`; use `conda run --no-capture-output -n <env> ...`.

# Code Conventions

- For new projects, prefer the latest stable Python version supported by required dependencies; do not target legacy Python versions proactively.
- Prefer modern Python APIs and idioms available in the project's supported Python versions, such as pathlib.Path over os.path.
- Follow the repository's existing formatter and linter; use Ruff for new Python projects when none is configured. Minimize unrelated formatting churn for upstreamable changes; broad cleanup belongs in an intentional, separate change for repositories you maintain independently.
- Respect `.gitattributes` and `.editorconfig`; do not normalize unrelated line endings.
- Do not hard-wrap prose in Markdown or other documentation.

# Working Style

- Keep changes small, readable, and consistent with the existing architecture. Before adding code, check the existing implementation and ownership boundary; prefer reuse over duplication or speculative abstractions.
- Keep implementation, tests, and documentation focused on the requested functionality and intended use. Add safeguards and constraints only for explicit requirements or concrete risks. Validate proportionally to risk without adding work merely for completeness; self-verification is not user acceptance.
- Before adding dependencies, inspect existing manifests and lockfiles. Large frameworks, model weights, and datasets require explicit approval.
- Keep authoritative documentation focused on the current supported state, updating it when implementation makes it materially incorrect. Remove obsolete code, workflows, and one-off migration logic when they have no ongoing use.
- Persist decisions and rationale only when needed to describe the current project state or explicitly requested; do not turn exploratory discussion or unselected alternatives into decisions or prohibitions.
- Use delegation-router when work has independently delegable subtasks or the user requests multi-agent work.

# Git & Commits

- Use git-safe-workflow for Git or gh writes, pushes, releases, or permission, authentication, and signing failures.

# Communicating with the User

- Default to Chinese for user-facing communication; conclusions must be grounded in actual verification (code/config checks or real runs), and anything unverified must be stated plainly.
- Full interpreter paths are for agent execution only; when showing commands to the user, use short forms (`uv`, `python`, `pip`, `conda`, `hf`, etc.).
- Respond to the user's actual claims and decisions. Do not preemptively argue against, warn about, or prohibit things the user did not propose; raise concrete issues only when they materially affect the task.
