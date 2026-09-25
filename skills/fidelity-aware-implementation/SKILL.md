---
name: fidelity-aware-implementation
description: Preserve intended inheritance when copying, porting, migrating, reimplementing, or refactoring an existing implementation. Use when the source implementation is a behavioral reference or contract, not for unrelated greenfield work.
---

# Fidelity-Aware Implementation

When working from an existing implementation, preserve the intended inheritance before applying requested changes. The implementing agent follows this skill directly; continuous supervision by subagents is not required.

## Identify the intended relationship

Determine the task from the user's original request and accepted decisions, not from your preferred implementation approach:

- **Copy**: Carry over the specified implementation and its capabilities. Do not downgrade this to recreating an approximation after understanding the general idea.
- **Port / migration**: Adapt the language, platform, environment, or storage while preserving semantics and contracts not explicitly changed.
- **Reimplementation / replacement**: Internal implementation may change. This does not automatically authorize reduced functionality or different external behavior.
- **Reference / imitate**: Carry over the characteristics the user specified. Do not require cloning the entire source system, or silently reinterpret a copy request as imitation.
- **Refactor**: Change structure or responsibility allocation; preserve behavior by default.

Tasks may combine modes, such as migrating an environment while restructuring internals. Proceed when the request is clear; do not ask the user to classify it again. Clarify only material ambiguity that would change the result. Do not repeatedly reopen areas the user has explicitly excluded or accepted.

## Establish the preservation baseline

Read the relevant source implementation, callers, and configuration, not just feature descriptions or new code. The source implementation itself is part of the specification. **Absence from the user's description is not evidence that existing behavior is disposable.** Explicit new requirements take precedence over old behavior. Explain conflicts, existing bugs, or security issues rather than silently fixing them or mechanically insisting they be preserved.

Identify the preservation surface affected by the task: user-visible behavior and UI interactions; functional branches and edge cases; interfaces and defaults; state and lifecycle; side effects and ordering; failure and recovery behavior; events, callbacks, hooks, and commands; configuration switches; extension points and compatibility entry points. Expand only the relevant parts, not a full checklist for every small edit.

Map relevant capabilities into three states:

1. **Preserved**: Identify the corresponding implementation and applicable conditions in the new version.
2. **Intentionally changed or removed**: Identify the user requirement or accepted decision authorizing the difference.
3. **Unaccounted for**: Investigate possible silent loss. "The user did not mention it" is not an explanation.

Brief working notes are sufficient for small tasks; use a mapping table for complex replacements when useful. Do not turn fidelity documentation into an additional deliverable by default.

## Implement and verify parity

Change internal architecture within the authorized scope. "Simpler" or "apparently unused" is not authorization to remove behavior. Check conditions that a working main path can conceal: an independent switch blocked by a new master switch, an old entry point that remains present but no longer works, missing re-entry/retry/cancellation/cleanup paths, or changed persistence semantics despite correct in-memory behavior.

At completion, trace capabilities from the old implementation into the new one, rather than checking only whether the new version runs. Matching names, file counts, or code shapes do not prove equivalence. Conversely, renaming or moving responsibilities does not establish loss merely because text disappeared. Trace actual entry points, state conditions, and effects.

Use existing tests, comparative runs, representative inputs, and source-path evidence to establish behavioral / contract parity. Prioritize affected branches and switch combinations.

Report intentional changes, key behaviors confirmed preserved, and remaining verification gaps concisely. Compilation, startup, or a passing happy path does not establish complete inheritance. Do not claim fidelity without completing the comparison. Independent post-implementation review belongs to Adversarial Fidelity Review, not to a continuous supervision step in this skill.
