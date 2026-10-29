# Project Instructions

<!-- Replace bracketed text and delete unused guidance before adopting this file. -->
<!-- Keep only project-specific facts and constraints; global AGENTS.md already supplies general working rules. -->

## Project Identity

- Purpose: [one-sentence description of what this repository is for]
- Non-goals: [important adjacent work this repository should not grow into]
- Sources of truth: [`README.md`, design documents, schemas, or other authoritative files]
- Generated or runtime-only data: [paths that must not be edited or committed]

## Runtime and Commands

- Runtime: Python [version]. Treat `pyproject.toml` and `.python-version` as authoritative.
- Environment and package manager: uv. Do not install packages globally.
- Setup: `uv sync`
- Run: `[command]`
- Available tests: [commands]
- Available lint/format/type checks: [commands, or "not configured"]
- Default validation: [smallest checks normally sufficient for ordinary changes]
- Full validation: [broader suite, and when it is warranted]
- Expensive or external validation: [commands requiring network, models, large datasets, services, GPU, etc.]

<!-- Replace the following ownership workflow if this is a multi-contributor repository. -->
## Ownership and Delivery

- This is a single-maintainer repository.
- Do not commit or push unless the user explicitly asks.
- When asked to commit and push accepted changes, commit directly to `main` and push `main`; do not create a feature branch or pull request unless explicitly requested.

<!-- Multi-contributor replacement:
- This is a multi-contributor repository. Preserve concurrent work and inspect repository contribution rules before editing.
- Work on a feature branch and use a pull request for delivery. Do not push or open a pull request unless the user explicitly asks.
-->

## Project-Specific Constraints

- [domain invariant or architectural boundary]
- [files or behavior that must not be changed without explicit approval]
- [documentation or generated artifacts that must be updated with implementation changes]

## Project Decisions

- Durable decisions: [what kinds of decisions should be preserved, and where]
- Do not persist: [exploratory alternatives, temporary implementation choices, rejected ideas, etc.]
