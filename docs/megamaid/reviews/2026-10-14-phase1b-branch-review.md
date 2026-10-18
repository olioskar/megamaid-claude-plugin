# Phase 1b branch review — feat/v0.3.0-planner-role (2026-10-14)

Two independent lenses on Opus 5.5: contract (C), code and tests (T). Range 49cf2dc..d8dc989 (6 commits). The T lens ran every free gate green, replayed the new case's graders against synthetic traces, and tried 17 mutations against check-contract. Fix pass: one commit, dce7f99.

## Critical (fixed)

- **T-C1 / C-I4. No grader checked which agent ran.** Replaying the case's 11 graders against synthetic traces with `megamaid:implementer` or `general-purpose` dispatches passed 11/11. Fixed: `planner-dispatched` (`tool_used` Agent, `"subagent_type":"megamaid:planner"`, min 2); `plan-fail` replay fixture pins it.
- **T-C2. `all-two` would fail a correct run.** The `All N instruction files ready` line of the Step 7 template never appears in kept plan-run traces; `Medium (N)` does. Verified on `e-vVEQ2J` (0 vs 2). Fixed: `medium-label` (`Medium \(2\)`), `all-two` removed.

## Important (fixed)

- **T-I1. The §5 plan-lane grep was satisfied by prose** (plan line 144) and slipped reordered flags (mutations A, C, D, E). Fixed: a line-scoped negative check (`(resolve|brief) … --(lane|skill) plan` without `--role planner`, any flag order) plus positive checks anchored to the `megamaid.py" resolve …` and `megamaid.py" brief …` code-block commands. Each mutation now caught; Review Focus #3 closed instead of accepted.
- **T-I2. The fixture `defaults.json` could drift from the shipped one**, so the foreign-planner brief fixture would prove the fixture text, not the shipped text. Fixed: `cmp -s` guard in §8 (mutation O caught).
- **T-I3. A planner writing source through Write or Bash passed.** Kept traces show `tool_used` does count subagent calls, but the planner cannot call Edit, so `no-edit` only constrained the orchestrator. Fixed: `util-untouched` and `config-untouched` file-target graders.
- **T-I4. `claude plugin validate` does not validate eval cases** (six misspelled-key mutations passed). Fixed: `scripts/fixtures/replay/plan-pass` and `plan-fail` with one ✓/✗ line per grader asserted in `scripts/test-replay.sh`, run by check-contract.
- **C-I1.** Help's configure example still said "use sonnet for plan". Fixed to "the fix implementer", matching README.
- **C-I2.** The planner file told the planner the directive list was reference only; the plain intro says read every file. Fixed: "Read the directive files the run brief lists, the ones it marks most relevant first."
- **C-I3.** The planner file said Step 7 "stops the item"; it reports `Missing:`/`Unexpected:`. Fixed.

## Minor (deferred)

- C-M1. Planner job sentence leaves out grouped findings (`G{n}`).
- C-M2. `dispatch-delivery.md` says every planner dispatch delivers two files; the non-code revise-doc planner gets the run brief only.
- C-M3. Scaffold comment names the tool restriction as a regression target; §8 gates that, the case now gates the one-file boundary.
- T-M1. §8 `disallowedTools` grep is whole-file, not frontmatter-scoped; a `tools:` allowlist is not refused.
- T-M3. `no-missing`/`no-unexpected` depend on the orchestrator printing those labels.
- C-M4 and T-M2 were local docs and the sdd ledger: fixed as bookkeeping (plan.md Phase 1b rewritten; Task 3 ruling corrected to "108 → 111").

## Rulings on "Declined to judge"

- `agents.planner: null` makes plan and fix DISCOVERED fail at resolve: stands, loud failure, same as implementer today.
- A foreign planner without Write is not detected before dispatch: stands, Step 7 reports the missing file.
- Planner keeps Bash: stands per the spec; file-target graders catch source writes in the eval; hooks are Phase 3.
