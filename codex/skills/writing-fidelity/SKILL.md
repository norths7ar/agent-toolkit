---
name: writing-fidelity
description: >
  Use when creating, revising, or reviewing substantial written artifacts,
  project documentation, technical explanations, or long-form or formal
  replies. Also use when the user requests correction of intent interpretation,
  defensive wording, or the organization of an explanation. Preserve user
  intent, document purpose, useful information, coherent reasoning, and natural
  prose. Routine conversation and code changes alone do not trigger this skill.
---

# Writing Fidelity

## Core principles

Writing should serve the reader and the document's purpose, not the author's desire to demonstrate completeness, caution, or diligence.

Understand what the user is actually asking, preserve the intended meaning, and exercise editorial judgment. A technically accurate document can still be poor if it contains unnecessary information, obscures important relationships, or makes the reader reconstruct the argument.

Aim for accurate, relevant, coherent, and natural writing. Neither brevity nor exhaustiveness is an end in itself.

## 1. Intent and reasoning

Interpret requests in their actual context. Distinguish observations, assumptions, hypotheses, questions, requirements, and accepted decisions.

- Respect explicit user decisions and previously established context. Do not silently reinterpret, expand, or override them.
- Do not invent unstated intentions, objections, misconceptions, or opposing positions merely to address them.
- Exercise independent judgment when analyzing evidence or unresolved questions, without turning reasonable uncertainty into excessive caution.
- Technical hypotheses may guide investigation when clearly distinguished from established facts. Investigate material uncertainties when possible. Labeling a guess about user intent as an assumption does not authorize changing the task; clarify unresolved intent when it would materially affect the outcome or scope.
- If the user corrects an interpretation, update the working understanding and apply the correction to the ongoing task rather than merely acknowledging it.

Organize substantive analysis around the actual problem, relevant observations, approaches or changes, their outcomes, and the resulting conclusions. Use this as a reasoning sequence, not mandatory headings or a requirement to recount every attempt. Explain causal relationships when supported by evidence.

The goal is to advance understanding, not to demonstrate that every conceivable possibility has been considered.

## 2. Document purpose and ownership

First check the document topic and purpose already stated by the user. Where they are unspecified or incomplete, use the current task, existing content, and document location to understand:

- Who the intended readers are.
- What the document should help them understand or accomplish.
- Which information belongs within its scope.
- How it shares responsibilities with existing documents, code, and configuration.

Preserve the purpose and scope of an existing document. Use these questions as internal editorial guidance, not a mandatory questionnaire or report. Ask only when an ambiguity cannot be resolved from the available material and would materially affect the writing direction. Follow the repository's actual document organization and conventions.

Keep information in the document where it belongs. A document may briefly introduce or link to related material without reproducing another document's responsibilities.

Prefer a clear authoritative location for shared information. Avoid maintaining multiple independent explanations of the same behavior unless different audiences genuinely require them.

When revising documentation, preserve its existing purpose rather than using the opportunity to expand its scope.

## 3. Information selection and abstraction

Document information according to its value to future readers, not simply because it exists in the source code, configuration, development history, or conversation.

Prioritize information that explains:

- What behavior or outcome is intended.
- Why a particular design or constraint exists.
- How observable behavior differs from what readers might reasonably expect.
- What important relationships, assumptions, or limitations are not readily apparent from the implementation.
- What knowledge would otherwise require substantial investigation to recover.

Consider the accessibility of information in its original source.

Self-explanatory configuration names, values, interfaces, and straightforward code often need little additional explanation. Conversely, behaviors hidden in implementation details, event interactions, implicit conventions, or domain-specific mechanisms may deserve explicit documentation.

Adjust the level of explanation to the language, codebase, audience, and practical difficulty of understanding the source. Do not apply a fixed documentation density.

Documentation should complement code and configuration rather than mechanically translate them into prose.

### Decisions and development history

A discussion is not automatically a decision record. A decision is not automatically important enough to preserve.

Record decisions, alternatives, and rejected approaches when their rationale remains relevant to understanding, maintaining, or evolving the system.

Avoid preserving transient speculation, routine implementation choices, abandoned conversational branches, or the full sequence of discussion without a continuing reason.

## 4. Structure and narrative

Organize writing around the relationships the reader needs to understand.

Choose the structure according to the material, its relationships, and the reader's needs rather than a fixed document category or template.

- Develop related ideas together rather than distributing them across distant sections.
- Present causes, changes, consequences, and conclusions in a readable sequence.
- Keep evidence close to the claim or explanation it supports.
- Use headings, lists, tables, and emphasis when they genuinely improve navigation or comprehension.
- Prefer connected paragraphs when ideas depend on one another and benefit from continuous explanation.
- Avoid fragmenting a simple explanation into many small sections or repeating the same conclusion in several forms.

Structure is a means of communicating meaning, not evidence of writing quality by itself.

## 5. Language and tone

Write in natural, direct, precise language appropriate to the document and its audience.

Prefer concrete descriptions and meaningful explanations over abstract labels, rhetorical framing, or formulaic transitions.

Avoid common sources of artificial or defensive prose:

- Repeatedly explaining what the document, user, or author is *not* doing when the positive statement is sufficient.
- Introducing hypothetical objections or accusations that no one has raised.
- Using warnings or prohibitions to describe ordinary uncertainty or missing evidence.
- Defending past implementation choices, the agent's actions, or the writing process unless accountability or historical context is itself relevant.
- Restating a point in multiple formulations without adding information.
- Turning every observation into a highlighted conclusion or every paragraph into a separate section.
- Using elaborate contrasts, symmetrical phrasing, or rhetorical summaries merely for stylistic effect.

Express uncertainty where it materially affects the reader's understanding. State what is known, what remains uncertain, and why that distinction matters. Do not imply that the user has made an unsupported claim simply because a proposed explanation has not yet been verified.

For Chinese writing, favor idiomatic sentence flow and natural paragraph development. Avoid mechanical translations of English technical prose, excessive nominalization, repetitive contrast patterns, and conspicuously formulaic AI phrasing.

Do not make prose artificially terse. Give complex subjects enough room for proper explanation while keeping routine matters proportionate to their significance.

## 6. Review before delivery

Review the completed text from the intended reader's perspective.

Evaluate whether:

- It fulfills the user's actual request and respects accepted decisions.
- Its contents belong in this document.
- Important intentions, behaviors, and causal relationships are clear.
- Its detail adds useful information rather than duplicating readily available sources.
- Related facts and evidence are integrated rather than scattered.
- Its structure supports continuous reading and practical retrieval.
- Its wording is natural, proportionate, and free of unnecessary defensiveness.

When producing or revising text, resolve material writing problems in the deliverable. When asked to review or analyze, provide the requested findings without treating the review as authorization to edit files. Keep internal editorial checks out of the response unless requested.

Deliver the artifact, explanation, formal reply, or review the user requested. Match the requested form and scope; an explanation or review does not require creating or rewriting a document.
