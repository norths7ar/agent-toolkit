---
name: delegation-router
description: Use when work has independently delegable subtasks or the user requests multi-agent work; choose the team and assign bounded work.
---

# Delegation Router

For independently delegable work, consider whether delegation helps and reconsider when scope changes. The primary agent retains discretion. Delegation is encouraged when it adds clear value, but spawning an agent is not itself a success criterion. Ordinary questions and status checks need no routing ceremony.

## Choose the Team

Choose delegation based on task separability, context-transfer cost, uncertainty, review value, elapsed time, and usage budget. Delegate when it materially improves completion or independence; do not spawn agents for its own sake.

Prefer GPT-family models by default because their roles are better understood locally:

* **GPT-6 Astra / GPT-5.6 Sol**: complex coordination, difficult implementation, architecture work, high-value review.
* **GPT-5.6 Terra**: default for most delegated implementation, investigation, and repository work.
* **GPT-5.6 Luna**: optional for bounded low-complexity or high-volume work; do not choose it solely for lower cost.

Other connected models such as DeepSeek or MiMo may also be used when appropriate, but do not force them into GPT-style capability tiers without local evidence. Prefer observed task performance over provider claims, price, or parameter count.

Choose agent count and reasoning effort freely within the active tools and task constraints. Respect explicit user preferences. Do not silently substitute unrelated models when the intended choice is unavailable. Subagents must not recursively delegate unless explicitly authorized.

## Assign Work

Give each agent a concrete objective, relevant context and paths, permitted side effects, ownership boundary, and acceptance criteria. Include useful verification commands where known. For model overrides, use the active tool's supported history settings; with the current spawn tool, use `fork_turns: "none"` and a self-contained handoff.

For independent or adversarial review, provide requirements and raw evidence without planting suspected defects or a preferred verdict. Seek substantiated counterexamples and failure conditions, not a quota of criticisms. Reviews are read-only unless changes are explicitly assigned.

## Coordinate and Accept

- Keep concurrent write ownership disjoint. Shared files need an explicit handoff before another agent edits them.
- Parallelize independent work when useful; respect dependencies and user requests for sequential work.
- Read actual results before claiming completion. When work fails, revise the assignment, change the route, or take it over based on what was learned.
- The primary agent owns final acceptance and the user-facing result even when it performs no implementation. Inspect relevant artifacts and evidence, resolve conflicts, and verify proportionally to risk. Do not automatically redo every delegated step.
- Distinguish verified results from unverified claims and disclose material remaining gaps.
