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

As of 2026-10-19. Rewritten in place at every milestone and on "save progress"; never appended.

- Version: 0.4.0 on `origin/main`; local `main` is ahead by the commits below, unpushed (a push is the maintainer's call). Free gates green on Claude Code 2.1.303.
- Since 0.4.0, on local `main`: the eval suite ran (8/9, 4.53 USD, API key; `manifest-slice` missed once, passed alone: MM-043); the vendored types are 2.1.303 (MM-007); the ledger counts a main-loop turn only while the run owes one, so chat after a run no longer inflates the orchestrator row (MM-001); review Step 8 pins the Write tool and the closing note names the ledger (MM-013, MM-040); smoke ran green (MM-008); configure keeps its ledger (MM-039 decided).
- Ready: the first live run, one full `/megamaid:vacu-suck` in a real project of the maintainer's (MM-010). The maintainer runs it; the recipe is [knowledge/live-checks.md](../knowledge/live-checks.md), "Baseline measurement". It settles MM-014 and MM-015 and gives the go/no-go for MM-028.
- Done: the documentation reset (`chore/reset-docs`, PR #5, merged into `main` on 2026-10-18).
- Next work after the live run: the call-time guarantees (issues.yaml MM-025), approach first.
