---
name: vacu-suck
description: Use when the user wants the full megamaid pipeline — review → plan → fix — run as one continuous sweep. The user must invoke this explicitly — it executes code changes.
argument-hint: "[scope] [focus brief]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Agent
user-invocable: true
disable-model-invocation: true
---

STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`.

Commence Operation Vacu-Suck: review the code, plan the fixes, apply them. No pauses between steps, no confirmations requested, and no item skipped except one the planner could not reproduce.

## Inputs

Same as `/megamaid:review`:
1. **Scope** — PR number, branch, or file list
2. **Base branch** — config or `main`
3. **Focus brief** — `$ARGUMENTS`

If scope is ambiguous, ask once. This is the first of the three allowed questions (below).

## Step 1: Load config

Load the merged config per `${CLAUDE_PLUGIN_ROOT}/shared/config-loading.md`, once for the whole sweep:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" config
```

Run it — like every `megamaid.py` command line in this skill — from the project root, and read its JSON output; it is the merged config. A non-zero exit names the bad file — stop and show it.

## Overrides

These apply to every sub-step. Where a sub-skill's text conflicts with them, these win. Everything else in `/megamaid:review`, `/megamaid:plan`, and `/megamaid:fix` applies unchanged — the consolidation gate, the fix reviewer rule and its fallback chain, write-set batching, the 3-failure escalation, the per-sub-step manifest excerpt (cut, recorded, and cleaned by each sub-step from its own touched text), the pre-commit verification and revert-on-FAIL, and the HEAD and tree checks.

- **Models and effort.** `models.vacu_suck` replaces every lane default (`models.review`, `models.plan`, `models.fix.*`), including the trivial implementer; `effort.vacu_suck`, when set, replaces every `effort.*` lane the same way. Explicit `agents.<role>.model` / `agents.<role>.effort` overrides survive. `models.patterns` and `effort.patterns` are untouched: the scanner is never dispatched in a sweep. Mechanically: every `megamaid.py resolve` in a sweep carries `--coerce vacu_suck`, which applies exactly this rule.
- **Config.** Step 1 runs `megamaid.py config` once; the sub-skills reuse its JSON and do not run it again.
- **Directives.** The focus-brief matcher runs here once (Step 2) for the sweep's log; the sub-skills' own `megamaid.py directives` and `megamaid.py brief` calls run with the same brief and reproduce the same primaries.
- **Deferral.** Every finding is planned and fixed, Deferred included. "Deferred" is not a category in this mode.
- **Not reproduced.** An instruction whose `**Finding status:**` is `not reproduced` is skipped, not queued and not asked about; the final summary lists it under `Not reproduced (skipped)`.
- **Confirmations.** None between steps. Groupings, ordering, trivial/standard classification, and a focus brief that contradicts shipped behavior (review's edge case) are decided, not asked: follow the shipped behavior and log the conflict. Review's report is logged, not presented. The only questions in a sweep: scope at the start (if ambiguous), fix's dirty-tree pre-flight (only when uncommitted changes other than the run's own remain, fix Step 1.5), and "run again?" at the end. Fix's Step 1.6 red-baseline question is logged, not asked; the sweep proceeds. The stop after three FAILs on one item (fix 4f) and a batch stop (fix 4a) are halts, not questions: the sweep prints fix's per-item status list and ends there, as `/megamaid:fix` does.
- **Commits.** Per `fix.commit_per_item`, unchanged.
- **Focus brief.** `$ARGUMENTS` reaches every dispatch in every step under `## User focus for this run`, without re-asking.

## Step 2: Surface relevant directives

Apply the focus-brief matcher in `${CLAUDE_PLUGIN_ROOT}/shared/directive-matching.md`:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" directives --brief "<focus brief>"
```

Run it from the project root; log its `primary:` lines. Quote the brief for the shell (single quotes, or escape `"`, `$`, and backticks).

**Plugin root for the sweep.** The sub-skill files you Read below are not variable-substituted, and the plugin-root placeholder is not a shell variable. In those files the placeholder is written as a dollar sign, an opening brace, the name CLAUDE_PLUGIN_ROOT, and a closing brace. Wherever you see it — in the `manifest.py` and `megamaid.py` command lines, and in every Read target under `shared/`, `directives/`, and `skills/` — replace it with this literal path: `${CLAUDE_PLUGIN_ROOT}`. A `manifest.py` or `megamaid.py` command run with the placeholder unexpanded fails; for `manifest.py` that would silently fall back to delivering the full manifest.

## Step 3: Run review

Read `${CLAUDE_PLUGIN_ROOT}/skills/review/SKILL.md` and execute that workflow under the Overrides. Do not invoke the Skill tool for the sub-command — loading it as a skill would inject its wait-and-present instructions.

Step-specific: do not present the report and wait. Log the verdict and finding count, the excerpt log line, and any staleness note, run the excerpt `clean`, then continue.

Announce. For a code-shaped run the announcement goes in the **same message as the first tool call of the next step** (a text-only turn ends the sweep). For a non-code run it goes out together with the "After completion" block, and ending on text is correct there.

**Code-shaped:**

```
[review] Done — {verdict}, {N} findings ({breakdown by severity})
Moving to plan →
```

**Non-code:**

```
[review] Done — {N} findings on non-code artifact ({breakdown by label}).
Stopping here — non-code findings belong back in your design conversation, not an autonomous fix pass.
Report: {path}
```

## Step 3.5: Decide whether to continue

If review classified the artifact as **non-code** (review Step 3.5), stop here — do not run plan or fix. The review report is the final deliverable for this sweep. Skip to "After completion", non-code form.

If **code-shaped**, proceed.

## Step 4: Run plan

Read `${CLAUDE_PLUGIN_ROOT}/skills/plan/SKILL.md` and execute it under the Overrides (same mechanism as Step 3). Announce, in the same message as fix's first tool call:

```
[plan] Done — {N} instruction files created
Moving to fix →
```

## Step 5: Run fix

Read `${CLAUDE_PLUGIN_ROOT}/skills/fix/SKILL.md` and execute it under the Overrides (same mechanism as Step 3). The reviewer for each item follows fix Step 4e (role from the plan file's `**Specialty:**` header). Execution order: the `batches` order (fix Step 2.5): Critical → High → Medium → Low → Test gaps → Deferred → Discovered, an item after those its plan names on `**Depends on:**`. Track progress as `/megamaid:fix` does; when all items complete, present the full summary.

## After completion

**Code-shaped:**

```
[vacu-suck] Complete

Review: {verdict}, {N} findings
Plan: {N} instruction files
Fix: {N}/{N} items complete, {K} discovered during execution

All items:
  - C1: PASS
  - H1: PASS
  - ...

Not reproduced (skipped): {codes, or none}
```

Then ask **"Want to run the sequence again?"** with an explicit recommendation that quotes this round's severity counts:

- Critical / High findings present → yes, run again; the fixes warrant a follow-up sweep to verify no regressions.
- Only Medium / Low / Test gaps → judgment call; run again if a specific Medium might cascade, otherwise a focused human pass serves better.
- Round was clean (zero findings or only marginal Low items) → stop; further rounds yield diminishing returns and risk over-correction.

Wait for the user's response. If yes, start again from review with the same scope; the new review detects whether the fixes introduced regressions and surfaces Low findings below the previous threshold.

**Non-code:**

```
[vacu-suck] Complete (review-only — non-code artifact)

Review: {N} findings ({breakdown by label})
Plan: skipped — non-code artifact
Fix: skipped — non-code artifact

Report: {path}

The findings are intended to feed your next round of design conversation, not an autonomous rewrite. Skipping the "run again?" prompt — running another sweep on the same spec without changes will produce the same findings.
```
