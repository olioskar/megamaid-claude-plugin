# Phase 2 spec review (rev 1 → rev 2), 2026-10-18

Two independent lenses on `docs/superpowers/specs/2026-10-18-megamaid-usage-ledger-design.md` rev 1: contract (read-only) and code and tests (built the spec in a scratch clone, `scratchpad/spec-review-code/megamaid`; validate passed, check-contract OK, 46 tests, 0 fail). Unattended session: findings applied by the implementer, none ruled on by the maintainer.

## Critical

None.

## Important (all applied in rev 2)

1. **Sweep "run again" is the same run** (contract). No new `skill.prompt`, so counts persist; a round-2 report Write would move the ledger and leave round 1 stale. Rev 2: `report` is set once; the ledger stays beside the first report, cumulative; the baseline loop answers "no".
2. **Replay fixture facts wrong** (both lenses). `noncode-pass` holds only `docs/design.md`; its trace's report is `branch-feature-round1-report.md`. Rev 2 names `branch-feature-round1-usage.md`.
3. **Unverified assumptions behind the plan-native-planner grader** (contract): relative `$.fs.write` resolving in the eval sandbox; `file_exists` matching a dot-directory. Rev 2 names both under Eval run with the fallback.
4. **"No stored run writes nothing" needs a `$.state.get` before `update`** (contract). Rev 2: read, return, then update; the race named.
5. **Placement machinery over-built for the purpose?** (contract). Kept: plan.md names the place; rev 2 states the reason and the cost.
6. **Kit resolves relative fs paths before the test hook** (code). Rev 2: the rig strips the prefix.
7. **A throwing test hook is skipped by the kit** (code). Rev 2: the isolation test denies `fs.write` and asserts the `ledger failed: ` prefix.
8. **Report signal assumes the Write tool** (code). Rev 2: stated as an assumption in the Bound, confirmed by the first live loop; no prose pin.
9. **`none` run gets a ledger** (both). Rev 2: stated (`none-<startedAt>.md`, no cost line).

## Minor (all applied in rev 2)

`usageKey` defined on `lane === null`; a summed row's Model is the distinct models comma-joined; REPORT_NAME duplication named with a §5 check against `megamaid.py report-name`; README's "cleaned at the end of each run" amended; validate expectation corrected (`turn.complete` not gating); `lastTurnAt` from `$.clock.now()` with the out-of-order note; `ZERO` lives in `ledger.ts` and `run.ts` imports it; exact ledger strings fixed; log `+<input>/<output>` defined (input = three input counts); first-write log dropped for a log on every write; rig gains `fsWrites` ordered recorder, `usage: false`, `rig.cost` default, `rig.existing`, `rig.failWrites`; `turnInput` cast noted; "five review roles" became "every role but the two writers".

## Checked and found correct (by the reviewers)

turn.complete fields and when usage is absent; parentAgentId reaches the hook per the types; `$.session.usage()` free and `cost` optional; `$.fs.write` relative paths and directory creation; `update()` ifVersion retry; the kit drives `$.turn.complete`, `$.tool.call` Write and answers `session.usage`; observer pattern and validate output (`tool.call{tool=Write}` gating with .catch, `turn.complete` listed as a hook); fix stages by name; `.megamaid/.gitignore` content; REPORT_NAME matches `cmd_report_name`; §12 fails first on `usage.ts`; MIN_TESTS 29 is the current count; ideation estimate quoted correctly.
