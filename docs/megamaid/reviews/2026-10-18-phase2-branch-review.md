# Phase 2 branch review (feat/v0.4.0-usage-ledger, d532d83..7b0a61d), 2026-10-18

Two independent lenses, read-only, on the six-commit branch: contract, and code and tests (mutation-tested 37 mutations in a scratch copy; 35 caught, 2 survived as behaviourally equivalent). Free gates green for both. Unattended session: graded and fixed by the implementer.

## Critical

None.

## Important (fixed, 6b-commit after the release commit)

1. **§5 report-name check fed `\d` to `grep -E`** (both lenses). Passed locally (ugrep and BSD grep accept `\d`), would fail on CI's GNU grep. Fix: `REPORT_NAME` written as `[0-9]` (same JavaScript semantics, `reportName` tests unchanged) and §5 refuses `\d`, `\w`, `\s` in the extracted pattern. Seen to fail first against the `\d` source; suite 49/49 after.

## Minor (deferred; fixed the same day on the maintainer's "fix the minors")

- README and help state the review ledger unconditionally ("beside the review report"); the code needs a main-loop Write of a report-shaped name, so a review that stops before Step 8 writes nothing. CHANGELOG has "once the report exists"; README and help do not. Also `<report>-usage.md` reads as a suffix; the real name swaps `-report.md` for `-usage.md`. One sentence each.
- A review ledger in a tracked `paths.reviews` keeps changing after the run's answer (rewritten on every later main-loop turn until the next run or session end). CHANGELOG says the turns are counted, not that the file keeps moving. One clause.
- A 0.3.x-shaped run surviving a hot reload mid-session has no `usage`; `addUsage` throws each main-loop turn (caught, `next` replayed, an engine-reported hook failure per turn) until the next run or session end. No users yet; one guard (`stored.usage === undefined → return`) if wanted.
- `.megamaid/.gitignore`'s content (`*\n`) now has three sources (`megamaid.py`, `manifest.py`, `usage.ts`) and no check.
- `Object.values(run.agents)` is first-seen order only while no agent id is an all-digit string (the types do not say).
- Two guards are pinned only through the exception path (the `usage === undefined` return; `run.report ?? path` inside the update is race-only). Known, low value.
- Spec wording fixed in place (not code): the `none` run's cost line reads unavailable (spec said "no cost line"); a row's Model is the distinct last-turn models of the loops under the key, not every model a loop used; a turn ending before its spawn record lands counts nowhere (added to the live assumptions).

Resolution (commit after `c5df97a`, each code item fail-first): README, help and CHANGELOG say "once the orchestrator has written it" and name the file by its real shape (`pr-12-round1-usage.md`), README and help say the file keeps counting until the next run or session end; the CHANGELOG says the file is rewritten on each later turn; `usage.ts` skips a stored run without `usage` (test: a 0.3.x-shaped run leaves no write and no hook failure); §5 checks the three `.gitignore` writers (seen to FAIL against `manifest.py` writing `*` without the newline); `MegamaidAgent.seq` is stamped by `addAgent` and the ledger sorts rows by it (test: an all-digit id keeps its spawn place, seen to FAIL first); both guards are pinned directly: the two `.catch` handlers log `usage hook failed: <message>` (test: a denied `state.get`, seen to FAIL first) and a two-Write race test pins `run.report ?? path` (the mutation without `??` seen to FAIL). The spec items were already in place.

## Rulings confirmed sound by the reviewers

Reference build as body with rev 2 deltas applied; the backslash-path test asserting by suffix (kit resolves non-POSIX paths).

## Checked and found correct (by the reviewers)

Spec Bound vs code line by line; observers refuse nothing and the `.catch` replay is safe; `update()` races (4 turns at once all landed in a scratch probe); `writeLedger` failure paths; exact strings and log lines; the five Review Focus classes each pinned; types without production casts; §5 and §12; replay fixtures tracked and matched; docs and version consistent.
