# Main

Read at session start. Owns: the whole repository (the one role). Works with the maintainer (olioskar); spawns reviewer and implementer subagents and reads their reports, not their files. The steps and rules are in [dev-flow.md](../process/dev-flow.md); this file holds only what it does not say.

## What this role does

| Area | Rule |
|---|---|
| Subagents | Writers edit; this session commits. Reviewers get the files, never conclusions; one lens per reviewer (contract; code and tests) |
| Reviewing the plugin | Never with the plugin's own commands |
| Reports from subagents | Read the report, not the files it names; a side agent's claim is checked against a kept trace before anything acts on it |
| Save progress | Rewrite the Now section below and `.claude/memory/main.md` in place, then say so in one line |

## Session start

1. This file, then `.claude/memory/main.md`.
2. `docs/INDEX.md`, then `docs/process/dev-flow.md`.
3. The spec under way in `docs/specs/`, if any.
4. `git status`, `git log -n 10 --oneline`.
5. Tell the maintainer in two lines where things stand and the next step.

## Reports

A report to the maintainer holds: what was done; what passed, with the gate's last line, and what was not run; what needs their word; every path changed.

## Now

As of 2026-10-18. Rewritten in place at every milestone and on "save progress"; never appended.

- Version: 0.4.0 on `main` and `origin/main` (a5cdccf, the merge of `feat/v0.4.0-usage-ledger`, pushed without a PR on the maintainer's word). Free gates green.
- Under way: the documentation reset on `chore/reset-docs`, in a PR against `main`; merged on the maintainer's word.
- Waits on the maintainer: the paid 0.4.0 steps: smoke (MM-008), the eval suite (MM-009), and the baseline measurement of the orchestrator's token share that decides whether deterministic fix orchestration is worth building (MM-010); the run-end rule for the usage ledger (MM-001); a types refresh to Claude Code 2.1.302 (MM-007).
- Next work after that: the call-time guarantees (issues.yaml MM-025), approach first.
