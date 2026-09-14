---
name: delegation-router
description: Use when work has independently delegable subtasks or the user requests multi-agent work; choose the team and assign bounded work.
---

# Delegation Router

For independently delegable work, consider whether delegation helps and reconsider when scope changes. The primary agent decides whether delegation helps; neither spawning an agent nor narrating that decision is mandatory. Ordinary questions and status checks need no routing ceremony.

## Choose the Team

Choose based on task separability, context-transfer cost, uncertainty, independent-review value, elapsed time, and the user's usage budget. Direct execution is appropriate when handoff would cost more than it helps.

- Large models usually coordinate demanding work. They may also perform implementation or independent adversarial audits of especially complex work.
- Medium models are the default candidates for delegated implementation and investigation when usage is reasonably available. Optimize for useful completion time, not merely cheap tokens.
- Small models are optional for bounded, low-complexity or high-volume work when their observed speed and cost fit the task. Do not select them merely because an edit is small. The user has observed Luna to be slow; treat this as a local preference, not a universal benchmark.
- Choose agent count, reasoning effort, and division of work freely within the exposed tools and task constraints. A complex task may justify a primary agent that only decomposes, coordinates, and accepts work.

Allowed delegation models: large = GPT-6 Astra or GPT-5.6 Sol; medium = GPT-5.6 Terra; small = GPT-5.6 Luna. This list intentionally limits delegation across OpenCodex providers. Use only listed models and reasoning levels actually offered by the active tool; if none are available, proceed directly without repeatedly retrying or substituting another provider model. Use models outside this list only when the user explicitly authorizes them.

Respect explicit user preferences and higher-priority tool constraints. Do not delegate when prohibited or unavailable. A subagent must not create further agents unless recursive delegation is explicitly authorized by the user.

## Assign Work

Give each agent a concrete objective, relevant context and paths, permitted side effects, ownership boundary, and acceptance criteria. Include useful verification commands where known. For model overrides, use the active tool's supported history settings; with the current spawn tool, use `fork_turns: "none"` and a self-contained handoff.

For independent or adversarial review, provide requirements and raw evidence without planting suspected defects or a preferred verdict. Seek substantiated counterexamples and failure conditions, not a quota of criticisms. Reviews are read-only unless changes are explicitly assigned.

## Coordinate and Accept

- Keep concurrent write ownership disjoint. Shared files need an explicit handoff before another agent edits them.
- Parallelize independent work when useful; respect dependencies and user requests for sequential work.
- Read actual results before claiming completion. When work fails, revise the assignment, change the route, or take it over based on what was learned.
- The primary agent owns final acceptance and the user-facing result even when it performs no implementation. Inspect relevant artifacts and evidence, resolve conflicts, and verify proportionally to risk. Do not automatically redo every delegated step.
- Distinguish verified results from unverified claims and disclose material remaining gaps. Mention delegated contributions when useful to understanding the result.
