# Call-time guarantees (MM-025), with the baseline's small fixes (MM-044, MM-045, MM-046, MM-048)

Status: draft for the maintainer's go; contract review settled in three rounds (log below). Branch `feat/call-time-guarantees`. The maintainer's ask (2026-10-28): "goahead with all and the smaller issues as you recommend"; the measure: "we need to make sure megamaid does a perfect job". Deterministic fix orchestration (MM-028) is the next spec, built on this one; MM-047 (batches ignore plan order) moves there, because the code that batches will own ordering.

## Why

Every rule an agent keeps is prose today; the model can drift from it, and the 2026-10-28 baseline ([costs](../knowledge/costs.md)) showed it does: a planner dispatched with the implementer's brief (MM-044) and the orchestrator patching code itself (MM-048). A hook that refuses the wrong call at the moment it is made turns a rule the model usually keeps into one it always keeps.

## What changes in the module's shape

- **First guards that deny.** The new guards fail closed: `.catch(($, e, next) => next.called ? next(e) : { deny: '<rule> (megamaid guard fault)' })`, so a throwing guard refuses instead of letting its call through. Each deny reason states the rule and what to do instead. Design rules' "Guards fail closed" and "Observers refuse nothing" rows are rewritten to list them; "No hook returns `deny`" goes.
- **Guards act only on megamaid's own agents and dispatches.** A `tool.call` guard checks a call whose `agentId` is a recorded agent of the stored run; any other call passes. Its `.catch` passes a main-loop call (`e.agentId === undefined`) and denies a subagent's; a fault in the state read can therefore refuse another plugin's subagent call once (Bounds). The `agent.spawn` guard checks only a spawn whose prompt names a run brief. No guard depends on a run being active, because the stored run is the last run started, not an active one (MM-020); guards on the main loop are not built (Decisions).
- **One `agent.spawn` registration.** Validate refuses a second matcherless registration (engine.md), so parts 4 and 5 join `agents.ts`'s registration. Its `.catch` denies only when `parseBrief(e.prompt) !== null` and `next` was not called; any other fault passes the spawn (`next(e)`), so a user's unrelated spawn is never refused by a fault. `agent.spawn` moves from the observers row to the guards row (design-rules.md, hooks-module.md).
- **Config comes from `megamaid.py`.** A hook that needs a resolved model or a write-set runs `python3 -I <$.plugin.root>/scripts/megamaid.py …` through `$.process.run` (in the types: argv, session cwd, 30 s default). Computed before `next(e)`, stored on the agent's record after it.

## Parts

| # | Part | Event | What it does |
|---|---|---|---|
| 1 | Implementer write boundary | `agent.spawn` records; `tool.call` Edit and Write guard | For a briefed spawn with lane `fix` and role `implementer`, read `Instruction file:` and `Repository:` from the prompt and store the item's write-set from a new `megamaid.py write-set --file <instruction>` (the per-item logic `batches` prints: `## Where` paths, else `**File(s):**`, `**Target spec:**` for a revise doc). An Edit or Write from that agent is allowed when its `file_path`, resolved, equals a write-set entry resolved against `Repository:` or lies under a directory entry; otherwise denied, the reason naming the write-set and saying to stop and report a divergence. An empty write-set denies every edit: the instruction is defective and the reason says so. NotebookEdit is withheld from the implementer already |
| 2 | Planner write boundary | same | For a briefed spawn with lane `plan` and role `planner` (code plans, revise docs and fix's discovered-item planners all carry a plan brief), store `Output file:` from the prompt. An Edit or Write from that agent to any other path is denied |
| 3 | Fix reviewer never diffs past HEAD | `tool.call` Bash guard | A Bash call from a recorded agent with lane `fix` and a role other than `implementer` whose command holds `HEAD~` or `HEAD^` is denied; the reason gives `git diff HEAD -- <reported files>` |
| 4 | Model at spawn | `agent.spawn` rewrite | For every briefed spawn whose call names no model (`e.model` undefined), set `model` from `megamaid.py resolve --role <role> --lane <lane>`, as resolve prints it. Lane: brief lane `review` → `review`; `plan` → `plan`; `fix` with role `implementer` → `fix.implementer_<class>`, class from a `Class: trivial` or `Class: standard` line the fix dispatch prompt carries, standard when absent; `fix` with any other role → `fix.reviewer`. `--coerce vacu_suck` when the stored run's skill is `megamaid:vacu-suck`. A model the call names wins (Decisions). Effort stays with the orchestrator: the spawn input carries no effort, and a `turn.step` rewrite may not reach the agent's first request before its record lands |
| 5 | Brief fits the agent | `agent.spawn` guard | Deny a spawn whose prompt names a run brief when the `subagent_type` that `resolve` gives for the brief's role differs from `e.subagentType`; the reason names the config roles that resolve to `e.subagentType` and the `megamaid.py brief` command. When `resolve` exits 2 (the brief's role is not in config) the spawn passes and the hook logs it. Fixes MM-044 (a `megamaid:planner` dispatched with the implementer brief) and honours foreign overrides (the comparison is with config, not with agent names) |

Small fixes, each its own commit:

| # | Issue | Change |
|---|---|---|
| 6 | MM-046, stray `/` in write-sets | `paths_in` drops a token with no letter or digit; a test with the baseline's `## Where` text. Lands first: part 1 reads write-sets |
| 7 | MM-045, fix pre-flight counts the run's own output | Fix Step 1 also reads `paths.reviews`; Step 1.5 ignores the run's own paths (Step 1.6) and anything under `paths.reviews`, so vacu-suck's pre-flight question fires only on the user's changes |
| 8 | MM-048, PASS with a requested change | The fix reviewer brief's decision rule: a reviewer that wants any change to the diff returns FAIL with it, never PASS with a note; the `DISCOVERED` block and the `Unverified:` line are not change requests. That FAIL takes the existing route (revert, retry, counts toward three). Fix Ground rules gain "the orchestrator never edits a file in a write-set, except to revert an attempt (4f); a change goes through an implementer" |

## Prose

Single source governs: a rule a hook enforces lives in the hook. The model still has to know where its edges are, so each agent keeps one line saying the boundary is enforced and what to do on a refusal (report a divergence); the detail moves into the deny reason. The two-arm rule (design-rules "Trust the model") applies to passages whose failure the model must avoid on its own, not to ones a hook enforces.

| Part | Change |
|---|---|
| 1 | implementer.md "Write only inside the instruction's `## Where`" → one line: edits outside `## Where` are refused; report a divergence. Fix 4a gains a sentence: an item whose write-set is `(none)` is announced as defective (`{code} — not dispatched: the instruction names no file`) instead of dispatched. `batches` is unchanged (it still batches such an item alone, megamaid.py:76) |
| 2 | planner.md's first Boundaries bullet → one line: writes other than the output file are refused; drop "elsewhere nothing checks" |
| 3 | none; `git diff HEAD -- <files reported by implementer>` (fix-reviewer-brief.md:12) stays, pinned by check-contract §5 |
| 4 | Each briefed dispatch's "Pass `model:` as the Agent call's `model`" in review, plan and fix becomes: pass a model only when the user named one for this run; otherwise the hook sets config's. dispatch-delivery's Model paragraph says the same for briefed dispatches and keeps the current rule for briefless ones (patterns' scanner and shaver pass the resolved model themselves). Fix 4d adds the `Class:` line to the implementer prompt |
| 5 | none; the brief steps stay, now enforced |

## Bounds

- A guard sees only the tools it hooks. An implementer writing through Bash (`sed -i`, a redirect) passes part 1; fix 4d.1's git checks stay and stop the item.
- A guard knows an agent once its spawn record lands; a tool call before that passes. The baseline saw no turn before its record in 84 spawns.
- Part 3 also refuses a plan's `Check:` line that holds `HEAD~`; plan-brief gains "a `Check:` never diffs past `HEAD`".
- Part 4: a model the session forces on every subagent outranks the hook (types). An orchestrator that passes a model nobody asked for wins over config; the prose is the only check on that.
- A fault in a `tool.call` guard's state read refuses that subagent call (fail closed), another plugin's included; the agent sees the reason and can retry.
- A user's own agent dispatched with a megamaid brief is guarded as a megamaid dispatch.
- The script path is `$.plugin.root`, unprobed for a marketplace-installed copy (MM-016).

## Tasks, in order

1. Probe (haiku, under 0.10 USD, on the maintainer's word): `$.process.run` runs `python3` from a hook; an `agent.spawn` model rewrite shows in the spawn result; a `tool.call` deny reaches a subagent as a tool error; `e.subagentType` for a plugin agent is spelled as config spells it (`megamaid:planner`). Engine facts confirmed go to engine.md.
2. Part 6, then `write-set` (script tests first).
3. Part 1, part 2, part 3, part 5, part 4: module tests first, each failing first.
4. Parts 7 and 8 (prose).
5. Docs: hook-events.md (registrations, "No hook refuses"), hooks-module.md (registration count, failure-shape table, Bounds row on the report Write), design-rules.md, features docs where a user sees a refusal; check-contract §12's RUN file list if a new file reads or writes state, and `MIN_TESTS`.
6. Graders: the three `model-passed` graders (dispatch-delivery, manifest-slice, plan-native-planner) match `"model"` in the Agent input and fail once the orchestrator stops passing it, so they go. In their place, `dispatch-delivery`'s scaffold, which already writes a config, adds `models.plan: "sonnet"` (differs from the agents' `opus` and the pinned session), and a `regex` grader matches `claude-sonnet` in the plan ledger's planner row (the Model column holds the full id); `plan-native-planner` keeps its no-override scaffold. `scripts/test-replay.sh`'s expectation lists and the dispatch-delivery fixtures gain a ledger with and without a sonnet planner row. The ledger path carries a timestamp; whether a `regex` file target takes a glob is settled offline with `scripts/replay-graders.py` against a fixture first, and if it does not, the grader moves to a review case's fixed-path ledger. `reviewer-never-head-tilde` grades the orchestrator's dispatch prompt and stays as is; part 3 is held by its module test.

## Checks (what done looks like)

- Module tests per guard: an allowed call passes; a refused call is denied with its reason; a call from an unrecorded agent passes; a throwing guard denies; for `agent.spawn`, a throwing hook on a briefless spawn passes it. Part 4: each lane mapping, the vacu-suck coercion, a briefless spawn keeps its model, a briefed spawn that names a model keeps it.
- Script tests: `write-set` for `## Where`, `File(s)` and `Target spec`; the `/` token.
- `scripts/check-contract.sh` ends `check-contract: OK`; `claude plugin validate .` passes with the accepted warning.
- Paid, each on the maintainer's word: the probe (task 1, under 0.10 USD), smoke (about 0.25 USD) and the full suite before the PR (about 5 USD).

## Decisions

1. **No main-loop guards** ("the orchestrator never reads PATTERNS.md", "never edits a file in a write-set", "a megamaid agent is never dispatched without a brief"): they would refuse the user's own work after a run ends, since nothing marks a run's end. The maintainer, 2026-10-28: "lets leave it".
2. **A model named in a dispatch wins over config.** The hook fills a model only when the call names none. The maintainer, 2026-10-28: "its an extra step to update the config for model overwrites. From my experience with writing and using the mother of megamaid, comb:the-desert, that is a useful and often used thing to have".

## Review log

Round 1 (contract lens, 2026-10-28): part 5 acted on the main loop → narrowed to the brief-fit check; one `agent.spawn` registration → `.catch` denies only briefed spawns; part 3 named prose and a grader wrongly → corrected; `model-passed` graders → task 6; part 4 coverage (patterns, lane mapping, vacu-suck) → spelled out, effort left to the orchestrator; write-set for revise docs, path resolution, empty set → part 1; "planner in the fix lane" → plan lane; full-id normalisation dropped; MM-047 moved to MM-028; MM-048 moved into the reviewer's decision rule.

Round 2 (2026-10-28): the ledger grader could not tell a rewrite from the default → a scaffold with a distinct model; `tool.call` `.catch` on non-megamaid calls → main loop passes, the subagent bound stated; empty write-set prose; §12 "reads or writes"; dispatch-delivery keeps the briefless rule; reverts exempt from the ground rule; part 5 on `resolve` exit 2 and shared `subagent_type`s; "may not" for the effort race. Then the maintainer's two decisions.

Round 3 (2026-10-28): the no-write-set rule goes in fix 4a, `batches` unchanged; the distinct-model grader moves to dispatch-delivery with its replay fixtures; a module test for a dispatch-named model. None open.
