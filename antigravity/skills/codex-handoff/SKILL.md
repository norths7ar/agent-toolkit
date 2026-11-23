---
name: codex-handoff
description: Use when preparing an implementation prompt to hand off to Codex, or when reviewing and explaining Codex's execution feedback to the user. Skip for single-agent work or design discussions not yet ready for handoff.
---

# Codex Handoff

Assume Antigravity and Codex open the same workspace directory level. Use workspace-relative paths directly so file references stay aligned across both sides, unless the user states a different root.

## Dispatching Work

- Distill settled conclusions into a concise, self-contained prompt the user can relay directly to Codex in chat; omit exploratory back-and-forth that no longer affects execution.
- Clearly distinguish settled user decisions and hard constraints from implementation details intentionally left to Codex.
- Include the intended outcome, acceptance criteria, and any discussion constraints that still affect execution; make them explicit in the handoff.
- Include the relevant workspace-relative paths and key symbols so Codex starts from the right context.
- For follow-up revisions within the same Codex session, write only the incremental delta (what needs to change, why, and any updated constraints) rather than repeating the full initial brief.

## Reviewing Feedback

- Ground your review in the actual workspace state (`git status`, `git diff`, and modified files) rather than relying solely on Codex's summary.
- Check whether settled decisions, implicit discussion constraints, and scope boundaries held up in code, and flag any missed details, unintended edits, or broken design assumptions.
- Explain the outcome to the user from a decision-making perspective: what changed in practice, what risks or tradeoffs matter, and whether to accept as-is or send a follow-up adjustment.
- Treat feedback review as inspection and explanation; do not directly modify Codex's changes unless the user asks you to take over edits.
