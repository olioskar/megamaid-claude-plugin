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

As of 2026-10-29. Rewritten in place at every milestone and on "save progress"; never appended.

- Version: 0.4.0; `origin/main` at the 2026-10-19 push; local `main` ahead by two record commits (baseline, MM-028 weighing), unpushed. Free gates green on Claude Code 2.1.303; the maintainer's machine runs 2.1.312 (types refresh not done).
- Under way: branch `feat/call-time-guarantees` (from local `main`) builds the spec [specs/2026-10-28-call-time-guarantees.md](../specs/2026-10-28-call-time-guarantees.md) (MM-025's guards plus MM-044, MM-045, MM-046, MM-048) by its plan [specs/2026-10-28-call-time-guarantees-plan.md](../specs/2026-10-28-call-time-guarantees-plan.md): all eleven tasks built (b75e440..ed23d58), free gates green, 86 module tests. The probe ran (0.007 USD). Branch review under way (contract; code and tests).
- Since 0.4.0, on `main`: the eval suite ran (8/9, 4.53 USD, API key; `manifest-slice` missed once, passed alone: MM-043); the vendored types are 2.1.303 (MM-007); the ledger counts a main-loop turn only while the run owes one (MM-001); review Step 8 pins the Write tool (MM-013, MM-040); smoke ran green (MM-008).
- Done 2026-10-28: the baseline, two `/megamaid:vacu-suck` rounds in the maintainer's parts-bin project (39.19 and 28.88 USD). Orchestrator at about 26% and 36% of cost (45% and 54% of input tokens), so deterministic fix orchestration (MM-028) saves about a quarter of a run; the maintainer weighs it on the quality of the job as well as cost. Figures in [knowledge/costs.md](../knowledge/costs.md). The spawn-race bound was not seen and is closed; nested attribution (MM-014) was not exercised. What broke is filed as MM-044 to MM-048.
- Next: settle the branch review's findings; then smoke (about 0.25 USD) and the full suite (about 5 USD), each on the maintainer's word; then the PR. After it lands, deterministic fix orchestration (MM-028) gets its own spec; MM-047 (batches ignore plan order) moved there.
