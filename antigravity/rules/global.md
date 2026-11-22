---
trigger: always_on
---
# User Background

The user knows Python, has practical project development experience, is familiar with Windows, has used Linux, and understands computer architecture, software engineering, and common debugging techniques. They also have hands-on experience with consumer electronics, game configuration, and self-hosted services. They understand the broader technical approaches and engineering tradeoffs; specific commands, APIs, and tool details can be explained as needed. Build on this background and focus explanations on the mechanisms, evidence, and tradeoffs relevant to the current question.

# Machine and Shell

OS: Windows 11 Pro. Prefer PowerShell 7 via `pwsh.exe`; use Windows PowerShell 5.1 only when explicitly required.

# Temporary Files

Place temporary files in `.tmp` at the workspace root, or at the relevant repository root when the task concerns a repository. Do not create `.tmp` directories deeper in the directory tree or use alternative temporary locations. Within `.tmp`, name temporary files and task directories consistently using `YYYYMMDD-DO-SOMETHING`, with a descriptive task name and the appropriate file extension.

# Development Toolchain

- Shared runtime and development-tool baselines are maintained in `E:/Projects/agent-workspace/machine-rebuild/tooling-versions.json`, alongside the default configurations. Use these versions when creating projects or explicitly aligning development environments and project tooling.
- Record adopted runtime and package-manager versions in the project's appropriate configuration. Add linting and formatting tools as exact development dependencies and update the project lockfile. During ordinary development, follow existing project tooling, configuration, declared versions, lockfiles, and commands, and verify that the invoked tools match them.
- When updating the shared baselines, check current stable releases and relevant dependency compatibility. Installed versions are not a reason to retain an older baseline. Updating the shared baseline does not automatically upgrade existing projects.
- As part of completing code changes, run lint, resolve issues relevant to the changes, and format the affected files. Review the resulting diff. Keep repository-wide formatting separate from ordinary implementation work.

## Python

- For new projects, use the Python version in the shared baseline. Use another version when required by a concrete dependency or deployment constraint, and explain the reason.
- Prefer modern Python APIs and idioms available in the project's supported Python versions, such as pathlib.Path over os.path.
- Use uv by default for Python projects and respect the project's `pyproject.toml`, `uv.lock`, and `.python-version`. Never install Python packages globally.
- If `uv` is unavailable on PATH, use `C:/Users/jnkyl/.local/bin/uv.exe`.
- Retain existing Conda environments for projects that use them; use uv for new Python projects. When invoking Conda environments, use `conda run --no-capture-output -n <env> ...` rather than relying on `conda activate`.
- Default to Ruff for linting, import sorting, and formatting. When establishing project tooling, copy `E:/Projects/agent-workspace/machine-rebuild/ruff.toml` into the project configuration root and adapt it to the project's Python version and generated files.
- Default to Pyright for Python type checking. When establishing project tooling, copy the shared Pyright configuration into pyproject.toml and adapt it to the project's Python version and source layout.
- Do not use Any, unjustified casts, or diagnostic suppressions merely to silence type errors.

## JavaScript and TypeScript

- Prefer TypeScript over JavaScript for new code; do not migrate existing JavaScript to TypeScript by default.
- Follow the project's package-manager declaration, lockfile, and scripts. Use the shared Node.js and package-manager baselines when establishing or explicitly aligning tooling.
- Maintain npm at its own baseline version; do not assume the version bundled with Node.js matches it.
- Default to ESLint and Prettier for linting and formatting. When establishing project tooling, copy `eslint.config.mjs` and `prettier.config.json` from `E:/Projects/agent-workspace/machine-rebuild/` into the project configuration root; rename `prettier.config.json` to `.prettierrc.json`.
- Adapt the copied configurations to the project's JavaScript/TypeScript usage, runtime, framework, and generated files. Choose compatible versions of any required ESLint plugins.
