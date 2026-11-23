---
name: handoff-executor
description: Use when executing an implementation brief handed off from an upstream design conversation (such as Antigravity/Gemini) via the user, and reporting back for review. Skip for standalone Codex conversations or open-ended exploration.
---

# Handoff Executor

Assume the upstream agent and Codex see the same workspace directory level. Resolve incoming relative file paths against the shared workspace root unless told otherwise. Format output file references according to the current client's requirements, keeping each file unambiguously identifiable.

## Executing Handoffs

- Treat the incoming prompt as a settled design handoff rather than an open-ended brainstorming request; follow explicit decisions and constraints while resolving routine implementation details locally.
- If an upstream design assumption materially conflicts with the actual codebase, pause implementation that depends on resolving it and report the concrete conflict, its impact, and a recommended next step. Continue unaffected work without forcing a workaround or preempting the user's decision.
- When receiving incremental follow-up adjustments in the same session, apply the requested delta while preserving previously accepted changes.

## Reporting Back

- Organize the response around the substance needed for upstream review: what changed and why, any non-obvious implementation tradeoffs or assumptions, what was actually verified (and what remains unverified), and any conflicts or questions that need a decision.
- Keep the reply concise, self-contained, and directly relayable in chat without rigid boilerplate sections.
