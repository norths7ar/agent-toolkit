---
name: adversarial-fidelity-review
description: Review completed copies, ports, migrations, replacements, and substantial refactors for lost intent, behavior, or contracts when independent fidelity review is requested or warranted by concrete risk. Requires a separate reviewer subagent.
---

# Adversarial Fidelity Review

Choose review separately from implementation delegation, based on the user's request or concrete fidelity risk. Seek verifiable counterexamples to semantic preservation. Review is read-only by default.

## Independent review

**Use an independent reviewer subagent that did not participate in the implementation.** Implementer self-review is not a substitute.

Give the reviewer these primary materials:

- The user's original requirements, subsequent corrections, and explicitly accepted behavior changes. Preserve the original wording rather than supplying only the implementer's summary.
- Exact versions or locations of the old and new implementations, including uncommitted changes under review.
- The review scope and user-specified exclusions, plus configuration, callers, and interface material needed to understand runtime relationships.

Use clean or minimal context. Implementation summaries and claims of full preservation are claims to verify, not reviewer premises. The reviewer must independently read the relevant old implementation, new implementation, and diff. Neither the diff alone nor the final code alone is sufficient. Large reviews may be split by subsystem, but cross-subsystem behavior must still be checked.

If an independent subagent cannot be started, explicitly report that independent review is incomplete; do not present self-review as a pass. If the baseline or original requirements are missing, review what the available evidence supports and identify the gaps. Do not invent user authorization.

## Reviewer mandate

Derive the required inheritance from the original request, then challenge the claim that fidelity has been preserved:

- **Intent drift**: Was copy downgraded to reference-based imitation? Did refactoring introduce behavioral redesign? Was internal replacement treated as permission to shrink the contract?
- **Behavioral regression**: Did functional branches, defaults, edge cases, ordering, state transitions, re-entry, cancellation, retry, failure, or recovery paths change without authorization?
- **Contract loss**: Were interfaces, callbacks, hooks, events, commands, configuration options, or extension points removed, redefined, or left present but ineffective?
- **Silent deletion**: Where is each relevant old capability carried forward? If absent, is removal actually authorized by the user rather than justified after the fact by the implementer?
- **Unsupported simplification**: Was conditional, configurable, lifecycle-dependent behavior collapsed into a fixed path merely assumed to be equivalent?

Trace relevant source capabilities into the new entry points, conditions, and effects. Seek cases where the main feature works but a state or combination fails. Renaming, deleted code, different architecture, or features added only in newer upstream versions do not alone establish regression. Do not report accepted changes as defects or reopen explicitly excluded areas.

Ordinary logic bugs, resource leaks, and races may be reported, but they do not replace fidelity review. Zero findings is a valid outcome; do not impose a finding quota. Examine source and existing verification evidence.

## Findings and challenge pass

For each finding, provide exact source locations and versions for old and new behavior, a triggering condition or counterexample, user impact, and evidence that the change is not authorized. For missing code, identify the original entry point and the expected integration point in the new implementation. Prioritize by actual impact, not theoretical possibility.

Distinguish confirmed regressions, potential risks requiring confirmation, intentional design changes, and insufficient evidence. Separate source-proven control-flow differences from runtime reproductions. Lack of a runtime reproduction does not invalidate conclusive source evidence, but speculation must not be presented as fact.

Default to one independent reviewer. Use a second skeptic only for high-impact, disputed, or complex findings. The skeptic should independently verify the evidence and challenge false positives, missed regressions, and severity inflation.

## Synthesis

The lead agent checks the evidence, retains substantiated findings, and withdraws false positives. Do not dismiss a finding because you implemented the code, or accept it solely because a reviewer reported it. For genuine disagreements, state what evidence is missing.

Lead with actionable findings and briefly describe coverage and verification gaps. Include intentional changes only when they clarify the conclusion. "No findings" applies only to the examined scope; it does not establish complete equivalence.

This skill works independently; the implementer need not have used Fidelity-Aware Implementation.
