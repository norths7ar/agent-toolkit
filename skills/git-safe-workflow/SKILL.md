---
name: git-safe-workflow
description: Apply Git and gh operating rules for sandbox permission, credential and signing failures, filesystem permissions, and focused conventional commits. Use before executing Git or gh operations.
---

# Git Safe Workflow

- If git fails due to sandbox-inaccessible permissions, credentials, or signing keys, escalate and retry outside the sandbox; do not disable commit signing.
- Do not manually modify ACL or NTFS permissions on `.git` or project folders.
- Use conventional commit prefixes and keep commits focused; add a short body only when useful.
- If `gh` authentication fails inside the sandbox, retry with sandbox-external execution before re-authenticating.
