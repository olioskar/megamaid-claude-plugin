# Phase 1 plan review, consolidated

Plan: `docs/superpowers/plans/2026-10-13-megamaid-mod-skeleton.md`. Spec: rev 3. Two lenses, Opus 5.5, no paid runs.
Drift (D): 1 C / 2 I / 19 M. Executability (E): 2 C / 2 I / 11 M; E executed Tasks 1–7, 9 (and Task 2 Steps 1–2) in `scratchpad/plan-review/repo`; with its two Critical fixes the end state is 27 pass, tsc 0, validate pass, `check-contract: OK`.

## Critical

| ID | Finding | Fix |
|---|---|---|
| C1 (E-C1) | Task 5: `agentId` in a `$.tool.call` literal fails tsc (TS2769; `ToolCallArgs` drops it, types 12646–12652); the fallback names the same spelling. The kit passes it through at run time (sabotage verified). | Non-literal object: `const subagentRead = { tool: 'Read' as const, file_path: …, agentId: 'sub1' }`; delete the fallback sentence. |
| C2 (E-C2) | Task 7: `on('session.start', () => ({}))` is invalid (`SessionStartResult` is `{ cwd }`, types 11700); the test can never pass (26/27). | `on('session.start', (_$, e) => ({ cwd: e.cwd }))`; delete the "fill from the types" sentence. |
| C3 (D-C1) | No step checks CI on the finished branch (done-when "locally and in CI"). | Final step: `gh pr checks <n> --watch`; `contract` passes with ≥ 27 tests; ledger. |

## Important

| ID | Finding | Fix |
|---|---|---|
| I1 (D-I1) | Task 2 Step 3: `ci.yml` runs on push to main, PRs and dispatch, so a branch push starts nothing; `workflow_dispatch` would also start the paid evals job (up to 20 USD). | On go: push and open a **draft PR** (signed); watch its run; never `workflow_dispatch`. |
| I2 (D-I2) | Task 10: the `plan.md` replacement leaves line 38 "Done when: a no-op module loads…"; "Done 2026-10:" claims a merge that has not happened. | Replace through line 38; rewrite done-when in the spec's terms; no "Done". |
| I3 (E-I1) | Task 6 Step 2: `agents.test.ts` does not load (`parseBrief` not exported), so no test is seen to fail individually. | Step 1 adds a `parseBrief` stub returning null; Expected: 10 new FAIL, 15 pass, Ran 25. |
| I4 (E-I2, D-M9) | Task 8: both help runs share `--debug-file "$tmp/dbg"`; the second can pass on the first run's line. | `--debug-file "$tmp/dbg-${args:-overview}"` and grep that file. |

## Minor

| ID | Finding | Fix |
|---|---|---|
| M1 (E-M1) | Validate's actual text: `skill.prompt{skill=/"^megamaid:"/}`; `state writes` and `state reads` on two lines (reads from Task 3, `update` reads). | Correct the Expected lines. |
| M2 (E-M2) | plugin.json snippet lacks the comma after `keywords`. | Say so. |
| M3 (E-M3) | §5 line prints `test-sync-types: OK` every run. | Silence like its neighbours. |
| M4 (E-M4) | §10 comment lists exempt paths; not updated. | Add `vendor/claude-code-types/ (engine text)`. |
| M5 (E-M5, D-M3) | Task 5 test 4 adds only another skill name; no Read of the kit root as given; no non-`SKILL.md` file under the root. | Rename test 4 to "another stop-line skill (vacu-suck)"; add Reads of `$.plugin.root + '/skills/review/SKILL.md'` (stat answer maps it to REAL…) and `<root>/shared/x.md`; Review Focus 2 says every Read-note test reaches the root through another spelling. |
| M6 (E-M6) | Five-spawn caveat is resolved (`held` reaches 5). | Delete. |
| M7 (E-M7) | `plugin list --json` caveat resolved (top-level array, `id`, `enabled`). | Delete. |
| M8 (E-M8, D-M18) | Task 9 grader check placement ambiguous; inside `else` it is skipped when extraction fails. | "After §11's closing `fi`". |
| M9 (E-M9) | `not_loaded()`: `grep … \| grep -q` can SIGPIPE under pipefail. | `… \| grep -i 'not loaded' >/dev/null`. |
| M10 (E-M10) | Bare `claude plugin test .` in Tasks 3–7 can hit the rollout switch. | Note the fresh `CLAUDE_CONFIG_DIR` fallback in Task 3 Step 2. |
| M11 (E-M11) | sync-types resolves a relative source against the repo root. | Say so in its usage comment. |
| M12 (D-M1) | CI dry run is Task 2, not "the first plan task". | List as a deviation (still before any module code). |
| M13 (D-M2) | `fs.stat` and Read answerers live in the test file, not the rig. | Move to `test-rig.ts` (`answerStat`, `answerRead`). |
| M14 (D-M4) | Deviation #4 is not a deviation (the spec orders the suffix check first). | Remove. |
| M15 (D-M5) | The `RUN` grep counts three files but does not name them; lands in Task 7. | Name the three files; note Tasks 3–6 precede it. |
| M16 (D-M6) | Deviation #1: a void call can still throw synchronously; harmless because the stripping `.catch` covers it. | Say that. |
| M17 (D-M7) | Unlisted additions: `test-sync-types.sh`, the eval-grader gate, smoke's token grep on help, `.catch` on `session.end`, `isRunSkill`, smoke's dropped last line. | List as deviations (keep). |
| M18 (D-M8) | Briefless log line `-/unknown` is not in the spec. | List as a deviation. |
| M19 (D-M10, D-M11) | README line 7 drops "with the module loaded"; effort line's "(already met…)" contradicts the spec and is ungrounded. | Restore the phrase; drop the parenthetical. |
| M20 (D-M12) | PLAYBOOK "Where things live" omits the `hooks/` layout. | Name `register.ts` + one file per event + pure `run.ts`/`stop-line.ts`. |
| M21 (D-M13) | Bootstrap vendoring folded into the feature commit; spec says a refresh is its own commit. | Commit Step 4 as `chore(types): Claude Code 2.1.296`. |
| M22 (D-M14) | Tool check tests `npx`, message says node. | Check `node` and `npx`. |
| M23 (D-M15, D-M16) | Eval step lacks "not loaded → report, don't fix the runner"; live check lacks both versions. | Add. |
| M24 (D-M17) | "Rename the contract job's second step" names the wrong step. | Name it by its current title. |
| M25 (D-M19) | Task 9 Step 3 title overstates (`test-replay.sh` does not read the new graders; E found `replay-graders.py` does evaluate it). | Retitle; replay one kept trace against the new grader if one exists, else drop the claim. |
| — (E) | Not tested: removing the stripping `.catch` still gives 27/27 (budget overrun cannot be simulated in the kit). | Record in the plan as an untested path. |
