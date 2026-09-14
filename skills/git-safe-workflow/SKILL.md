---
name: git-safe-workflow
description: Use for Git or gh writes, pushes, releases, or permission, authentication, and signing failures. Skip routine read-only inspection.
---

# Git Safe Workflow

- If git fails due to sandbox-inaccessible permissions, credentials, or signing keys, escalate and retry outside the sandbox; do not disable commit signing.
- Do not manually modify ACL or NTFS permissions on `.git` or project folders.
- Use conventional commit prefixes and keep commits focused; add a short body only when useful.
- If `gh` authentication fails inside the sandbox, retry with sandbox-external execution before re-authenticating.

## Push Targets

- Before pushing, inspect the configured remotes and push URLs, and follow the project's push policy (for example, in `AGENTS.md`). Multiple remotes do not imply pushing to all of them; an upstream remote may be reference-only.
- When the project specifies primary and backup remotes, push the requested refs to both and verify each result separately. Report partial success explicitly; do not force-push to resolve a failed backup push without authorization.
- If the intended push targets remain ambiguous after checking project instructions and configuration, ask before pushing. A request to commit does not authorize a push.

## Tags and Releases

- Follow project release policy. Suggest a tag or release when completed work warrants a version milestone; execute only when authorized.
- Verify the target commit and existing tag/release before publishing. Do not replace published tags without explicit authorization.
- Push only intended refs and verify remote results. Inspect remote state before retrying an operation with an uncertain outcome.
