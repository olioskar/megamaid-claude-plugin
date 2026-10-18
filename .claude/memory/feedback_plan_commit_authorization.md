---
name: plan-execution-commit-authorization
description: "When executing an approved implementation plan that specifies per-task commits, the user authorizes the commits — confirm the policy once, then proceed without re-prompting per commit"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 18efc9d7-776d-4746-811d-bff50e9f9511
---

When executing an approved implementation plan (e.g. superpowers subagent-driven-development / GSD execute) whose tasks each end in a commit, treat plan-approval + "go" as authorization for those commits. Confirm the commit policy **once** at the start of execution, then proceed.

**Why:** The global rule in `~/.claude/CLAUDE.md` is "never commit unless explicitly asked." During the [[comb-the-desert-plugin-project]] PATTERNS-manifest execution (2026-05-29), the harness security layer flagged each subagent's per-task commit as unrequested. When asked, the user chose "Keep per-task commits (explicit OK)" — they want atomic per-task commits on a feature branch when they've approved a committing plan; the blanket no-commit caution is not meant to block plan execution.

**How to apply:** Before starting plan execution, (1) create a feature branch so `main` is protected, and (2) ask once how to handle the plan's commits (per-task / edit-without-committing / pause). Once the user says per-task is fine, don't re-prompt for each commit. Having the controller run the commits (subagents do edits only) avoids the per-subagent security flag and keeps commit control in one place. This does NOT generalize to commits outside an approved plan — for ad-hoc work the standing "never commit unless asked" rule still holds.
