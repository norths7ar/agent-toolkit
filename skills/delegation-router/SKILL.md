---
name: delegation-router
description: Use when work has independently delegable subtasks or the user requests multi-agent work; choose the team and assign bounded work.
---

# Delegation Router

For independently delegable work, consider whether delegation helps and reconsider when scope changes. The primary agent retains discretion. Delegation is encouraged when it adds clear value, but spawning an agent is not itself a success criterion. Ordinary questions and status checks need no routing ceremony.

## Choose the Team

Choose delegation for useful cost savings, context isolation, parallel progress, or independent judgment. Weigh these benefits against handoff cost and task uncertainty. Decide implementation delegation and independent review separately.

Use GPT-family models offered by the active delegation tool, respecting its model-override requirements:

* **Terra / Sol**: preferred candidates for delegated implementation and investigation; match the available version to task difficulty.
* **Astra**: demanding architecture, implementation, or review where its added capability justifies the cost.
* **Luna**: bounded work when observed speed and quality fit the task.

Choose agent count and reasoning effort to fit the work and budget. If the preferred model is unavailable, work locally or agree on an alternative with the user. Subagents must not recursively delegate unless explicitly authorized.

## Assign Work

Give each agent a concrete objective, relevant context and paths, permitted side effects, ownership boundary, and acceptance criteria. Include useful verification commands where known. Use a self-contained handoff and the active tool's clean-context option for context isolation or model overrides.

For independent or adversarial review, provide requirements and raw evidence without planting suspected defects or a preferred verdict. Seek substantiated counterexamples and failure conditions, not a quota of criticisms. Reviews are read-only unless changes are explicitly assigned.

## Coordinate and Accept

- Keep concurrent write ownership disjoint. Shared files need an explicit handoff before another agent edits them.
- Parallelize independent work when useful; respect dependencies and user requests for sequential work.
- Read actual results before claiming completion. When work fails, revise the assignment, change the route, or take it over based on what was learned.
- The primary agent owns final acceptance and the user-facing result even when it performs no implementation. Inspect relevant artifacts and evidence, resolve conflicts, and verify proportionally to risk. Do not automatically redo every delegated step.
- Distinguish verified results from unverified claims and disclose material remaining gaps.
