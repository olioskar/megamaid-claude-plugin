# Plan: megamaid

Roadmap for megamaid, the mods-based successor to comb. One phase = one PR. Each phase gets its own dated spec and task plan under `docs/superpowers/` before work starts (see PLAYBOOK, "The loop"). This file says what the phases are and why they are in this order; edit it when the order or scope changes.

Source: `docs/superpowers/specs/2026-10-12-comb-mods-ideation.md` (ideas A1–E12, API facts, token estimate).

## Goal

The comb review → plan → fix pipeline, with the rules that comb states in prose and checks after the fact enforced at call time by a hooks module, and with less orchestrator work per run. megamaid requires a mod-capable Claude Code. comb stays the plugin for older builds.

## Settled

- Name `megamaid`. Repo `olioskar/megamaid-claude-plugin`, cloned from comb at ddd4495 (comb 0.15.3) with history kept.
- A separate entry in the `olioskar/claude-plugins` marketplace. Versioning starts at 0.1.0.
- No prose fallbacks for builds without mods: a guard that does not load would be a silent gate.

## Phases

### 0. Identity
Rename comb → megamaid so the fork is its own plugin with no behaviour change. The rename touches 146 files (`/comb:` 299 hits, `comb.py` 135, `docs/combs` 102, `.comb/` 54, `comb.config.json` 29, `comb:<agent>` 64).
Open decisions, settled in this phase's spec:
- user-facing names: the config file, the report folder, the run-state folder, the helper script, and whether `the-desert` keeps its name;
- whether a comb config is read when no megamaid config exists;
- what happens when comb and megamaid are both installed;
- what happens to the tracked `PLAYBOOK.md`;
- CHANGELOG: a new 0.1.0 entry with comb's history kept below or dropped.
Done when: the free gates pass under the new name; smoke.sh passes once; no eval run (deliberate exception, see ledger).

### 1. Mod skeleton and spike
A hooks module (`hooks/register.ts`) that strips each skill's stop line, so a session without the module stops, and records runs and megamaid's dispatches with role and lane. Spike questions answered: `docs/superpowers/specs/2026-10-12-phase1-spike-findings.md`. Spec: `docs/superpowers/specs/2026-10-13-megamaid-mod-skeleton-design.md`.
Done when: the free gates pass with `tsc` and `claude plugin test`, locally and in CI; smoke passes (module on and off); one real `/megamaid:review` shows run detection; the full eval suite has run once with the not-loaded grader and is compared with comb v0.15.0.

### 1b. Planner role
`/megamaid:plan` and fix's DISCOVERED path dispatch their planners as the role `planner` (`agents/planner.md`, `agents.planner`) instead of borrowing the fix writer `implementer`: one job per role, boundaries written for planning, its own override. Nothing a user sees in a plan run changes. Decided 2026-10-14 (option A; rejected: one planner per report, which is Phase 6 territory, and a planner that can decline a finding). The planner is the senior of the pair: a good instruction lets a cheaper implementer apply it, so README and help say to keep `models.plan` strong and save on `models.fix.*` (guidance, not enforced). Spec: `docs/superpowers/specs/2026-10-14-megamaid-planner-role-design.md` (rev 2, amended). Own PR, release 0.3.0. No config migration: the plugin has no users yet.
Done when: the free gates pass (§5 plan-lane check, §8 disallowedTools asserts and fixture-drift guard, planner fixtures, replay fixtures); smoke passes once; the eval suite passes once with the new `plan-native-planner` case (the only case that runs the shipped planner) and the `dispatch-delivery` scaffold overriding the planner; a live `/megamaid:plan` on a non-code report produces one revise-doc.

### 2. Measure the baseline (idea C10)
The hooks module records usage per role from `turn.complete` and writes a Markdown usage ledger: beside the review report (`<report>-usage.md`) for `review` and `vacu-suck` once the report exists, under `.megamaid/usage/<skill>-<startedAt>.md` for every other run. Keyed on (lane, role) with the orchestrator as its own row; a nested spawn counts under its parent's role; run end is the next run's start or session end (so the orchestrator's turn count includes any later chat, visible in the ledger); the cost line is the session's spend over the run. Built 2026-10-18 in an unattended session (spec `docs/superpowers/specs/2026-10-18-megamaid-usage-ledger-design.md`, release 0.4.0). Remaining, when the maintainer runs them: smoke, the eval suite (two replay-only `usage-ledger` graders), and the measurement itself: one ordinary full loop, its orchestrator share recorded in the handover as the baseline that decides Phase 6.

### 3. Guarantees (A1–A4, B5)
The implementer file boundary (the instruction's `## Where`) and the planner's (one file, the output file its prompt names), the orchestrator not reading the manifest, the fix reviewer not using `HEAD~`, models and effort set at spawn, and briefs injected at spawn. Remove the prose each one replaces, and move its graders and gate needles with it. The stored run is the last one started, a subagent's included (`skill.prompt` has no `agentId`); a guard that reads it must not take it for the active main-loop run.

### 4. Mechanics out of prose (B6, B7, D11, D12)
Gate fixes by config (`fix-auto` goes if the spike allows it), resolve config at skill load, clean up excerpts at session end, and post a notice when a fix is interrupted. The fix gate is feasible: a hook can deny the Skill tool call once `fix` drops `disable-model-invocation`.

### 5. Visibility (C8, C9)
A fix / vacu-suck pane and a status line entry.

### 6. Deterministic fix orchestration (E), if Phase 2 says it is worth it
Batching, dispatch, verification and commits run from code through `$.agent.spawn` and `$.process`. The model keeps the judgment steps.

### 7. First public release
Marketplace entry, README, and a usage measurement against the Phase 2 baseline.
