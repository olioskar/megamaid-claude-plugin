# Phase 0 spec review — 2026-10-12

Spec: docs/superpowers/specs/2026-10-12-megamaid-identity-design.md
Reviewers: two independent subagents (Opus 5.5). Lens A: ambiguity and accuracy against the repo. Lens B: completeness against comb-dev decisions.
Claims spot-checked against the repo by the orchestrator: guard self-contradiction, comb.py:227 native prefix, manifest.py .comb writers (:78, :999), test-replay.sh:28, smoke.sh runs claude -p, last suite run v0.15.0 (comb-dev.md:16), help header, `comb version:` (not parsed by any script).

## Critical
- C1 (A+B) Guard can never pass: the import feature, its fixtures, CHANGELOG, README coexistence note and the guard's own regex all contain `comb`. Needs an allow mechanism.
- C2 (A) `/comb:<skill>` (~299 hits) has no task; plugin name change breaks smoke.sh and eval prompts unless they move in the same task.
- C3 (A) Task 3 can't stay green: native prefix `"comb:"` hardcoded at comb.py:227.
- C4 (A+B) manifest.py, test-manifest.sh, fixtures/expected/*, test-replay.sh:28 and replay traces in no task; both `.comb` writers must move in one commit.

## Important
- Guard scans contents only, not paths (A-I1); `-w` misses `comb_dir` (A-I2, B-M2).
- "Other gates green" undefined while guard is red (A-I3).
- Unspecified replacement strings: help header, plugin.json description, `comb version:`, `[the-desert] Complete`, `# comb brief —`, `comb.py:` error prefix (A-I4, B-M1).
- import-comb key rules, CLI contract, notice scope underspecified (A-I5..I7).
- plan.md Phase 0 done-when still requires the eval suite; deferred run not scheduled; "evaluated 0.15.3" is wrong — last suite run was v0.15.0 (A-I8, B-I1, B-I2).
- Existing docs/combs output stranded by the new defaults; import path rationale inconsistent (A-I9, B-I4).

## Minor
- smoke.sh is paid (two `claude -p` calls). Experiments README records comb runs. Mod requirement wording in lineage line. plan.md:49 pane name, MEMORY.md index pointer. Lineage/CHANGELOG link URL unspecified. Trigger replacement not decided. Notice repeats every run if import declined. Handover PLAYBOOK:22 `docs/combs` line. git grep misses untracked files. Known-gap narrower: test-replay replays two graders. LICENSE vs plugin.json author name mismatch (pre-existing, out of scope).
