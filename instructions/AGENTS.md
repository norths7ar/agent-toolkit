# Environment and Python Tooling

- OS: Windows 11 Pro. Prefer PowerShell 7 via `pwsh.exe`; use Windows PowerShell 5.1 only when explicitly required.
- For any PowerShell or native Windows command task, load and follow the powershell-safe-invocation skill.
- Prefer local execution; use Docker only when the project requires it.
- Use uv by default for Python projects and respect the project's `pyproject.toml`, `uv.lock`, and `.python-version`. Never install Python packages globally.
- If `uv` is unavailable on PATH, use `C:/Users/jnkyl/.local/bin/uv.exe`.
- Reserve Conda for GPU or binary-heavy stacks. Do not rely on `conda activate`; use `conda run --no-capture-output -n <env> ...`.

# Code Conventions

- For new projects, prefer the latest stable Python version supported by required dependencies; do not target legacy Python versions proactively.
- Prefer modern Python APIs and idioms available in the project's supported Python versions, such as pathlib.Path over os.path.
- Follow the repository's existing formatter and linter; use Ruff for new Python projects when none is configured. Minimize unrelated formatting churn for upstreamable changes; broad cleanup belongs in an intentional, separate change for repositories you maintain independently.
- Respect `.gitattributes` and `.editorconfig`; do not normalize unrelated line endings.

# Working Style

- Prefer small, targeted changes and preserve existing architectural consistency.
- For nontrivial implementation, investigation, review, and audit tasks, the primary agent must load and follow the delegation-router skill to decide whether and how to delegate. The primary agent chooses the team and execution role and owns final acceptance.
- Keep code readable and boring; avoid speculative abstractions and completeness-driven engineering.
- Validate proportionally to risk. Use automated checks for objective correctness, but do not treat self-verification as user acceptance; return control to the user for behavioral, UX, or preference-sensitive validation unless explicitly asked to perform it. Do not add tests, tooling, fallbacks, refactors, or documentation merely because they would make the change feel more complete.
- Update authoritative documentation only when the implementation makes it materially incorrect.
- Before adding dependencies, inspect existing manifests and lockfiles. Large frameworks, model weights, and datasets require explicit approval.
- Do not hard-wrap prose in Markdown or other documentation.
- Treat exploratory discussion and unselected alternatives as temporary context, not durable decisions. "Not chosen" does not mean rejected or prohibited.
- Persist decisions or rejection rationale only when they are required to describe the current project state, or the user explicitly asks to preserve them.
- Distinguish current-state implementation from one-off migration or transitional work. Treat temporary migration logic as disposable unless it has a concrete ongoing use case, and keep authoritative documentation focused on the current supported state.
- Do not infer permanence from existence: obsolete code, schemas, workflows, or documentation may be removed rather than preserved or generalized.
- Before adding new helpers, modules, or abstractions, search for the existing implementation and ownership boundary. Prefer one canonical implementation; avoid both premature abstraction and non-trivial duplication.


# Git & Commits

- Before executing Git or `gh` operations, load and follow the git-safe-workflow skill.

# Communicating with the User

- Default to Chinese for user-facing communication; conclusions must be grounded in actual verification (code/config checks or real runs), and anything unverified must be stated plainly.
- Full interpreter paths are for agent execution only; when showing commands to the user, use short forms (`uv`, `python`, `pip`, `conda`, `hf`, etc.).
- Respond to the user's actual claims and decisions. Do not preemptively argue against, warn about, or prohibit things the user did not propose; raise concrete issues only when they materially affect the task.
