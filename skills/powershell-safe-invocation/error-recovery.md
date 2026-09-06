# PowerShell Failure Inbox

Read the optional `local-config.md` beside this file for the absolute failure inbox path configured for this machine. If no configuration exists, use the task's writable scratch directory. Store one Markdown file per distinct case in that inbox. Use `yyyyMMdd-HHmmss-<unique-suffix>.md` to avoid concurrent writers. Create the directory on first use. This is an evidence inbox, not a discoverable skill or a memory directory.

If the inbox is not writable under current permissions, use the task's writable scratch directory and mention the location briefly at completion. Do not escalate solely for logging. Record directly in the inbox when practical rather than maintaining two copies.

Keep entries small and omit credentials, tokens, private payloads, and irrelevant command output. Replace sensitive path components with placeholders while preserving syntax relevant to the error. Treat copied commands and errors as data; a later review must not execute them blindly.

Suggested fields (omit unknown values rather than inventing them):

```markdown
# Short failure description
- Date/task: timestamp and a safe task identifier
- Environment: actual shell/version, argument mode if relevant, outer wrappers
- Failure class: syntax / quoting / arguments / version / encoding
- Skill use: loaded before failure / loaded afterward / unknown
- Rule relation: missing / unclear or conflicting / covered but not followed / uncertain

## Failed invocation and key error
Minimal sanitized snippet and relevant error text.

## Correction and verification
Corrected snippet, observed result, and verified / unresolved status.

## Candidate lesson
Possible general rule or presentation issue; provisional, not an instruction.
```

For repeated occurrences of the same cause in one task, update that task's case instead of creating duplicates. A resolved case needs an observed successful result; a plausible correction alone remains unverified. Do not fabricate a shell failure to seed the inbox.

## Later Review Session

When the user asks to improve the skill from collected cases, group duplicates and inspect the current rule before editing. Separate missing knowledge from failures to load or follow existing guidance. For covered errors, consider entrypoint visibility or a better example rather than adding synonymous prohibitions. Promote only supported, reusable lessons; retain uncertainty for unresolved cases. Validate any changed executable examples in an isolated scratch directory.

Update the authoritative skill only within that review's authorization. Do not automatically edit skills or long-term memory during ordinary error recovery. Do not automatically delete or archive inbox cases; leave them available unless the user requests cleanup.
