---
name: delegation-router
description: Use when work has independently delegable subtasks or the user requests multi-agent work; assign bounded work, coordinate agents, and verify results.
---

# Delegation Router

Follow the applicable AGENTS.md delegation and model-selection policy. This skill covers assignment, coordination, and acceptance.

## Assign Work

Give each agent a concrete objective, relevant context and paths, permitted side effects, ownership boundary, and acceptance criteria. Include useful verification commands where known. Use a self-contained handoff and the active tool's clean-context option for context isolation or model overrides.

For independent or adversarial review, provide requirements and raw evidence without planting suspected defects or a preferred verdict. Seek substantiated counterexamples and failure conditions, not a quota of criticisms. Reviews are read-only unless changes are explicitly assigned.

## Coordinate and Accept

- Keep concurrent write ownership disjoint. Shared files need an explicit handoff before another agent edits them.
- Parallelize independent work when useful; respect dependencies and user requests for sequential work.
- Read actual results before claiming completion. When work fails, revise the assignment, change the route, or take it over based on what was learned.
- The primary agent owns final acceptance and the user-facing result even when it performs no implementation. Inspect relevant artifacts and evidence, resolve conflicts, and verify proportionally to risk. Do not automatically redo every delegated step.
- Distinguish verified results from unverified claims and disclose material remaining gaps.
