# Handover: megamaid-dev

Updated: 2026-10-18 (Phase 2 instrument built on feat/v0.4.0-usage-ledger, review minors fixed; not pushed)

## State

- `main` at `d532d83` is megamaid 0.3.1. Branch `feat/v0.4.0-usage-ledger` (8 commits from `67e4795`) is megamaid 0.4.0: the usage ledger. **Not pushed; no PR.** Free gates green on every commit (validate; check-contract with tsc, 52 module tests, §5 report-name and .gitignore-writer checks, §12, replay fixtures). No paid run this session (maintainer's instruction).
- What 0.4.0 does: `hooks/usage.ts` attributes every `turn.complete` with usage to the orchestrator or the recorded agent it ran in, keeps the sum in `$.state` (per agent, plus the main loop), and rewrites a Markdown ledger after each counted turn: beside the review report (`<stem>-usage.md` next to `<stem>-report.md`) for `review` and `vacu-suck` once the main loop has written the report with the Write tool; under `.megamaid/usage/<skill>-<startedAt>.md` for every other run. Rows per lane/role, orchestrator first, a total, the orchestrator's share of input and of output tokens, and the session cost from run start to the last counted turn. Nested spawns count under the parent's role. Run end is the next run or session end, so later chat turns are counted as the orchestrator's (visible in its turn count).
- Records: spec `docs/superpowers/specs/2026-10-18-megamaid-usage-ledger-design.md` (rev 2, amended), plan `docs/superpowers/plans/2026-10-18-megamaid-usage-ledger.md`, reviews `docs/megamaid/reviews/2026-10-18-phase2-{spec,branch}-review.md`. Branch review: 0 Critical, 1 Important (fixed in `c5df97a`: `\d` in a `grep -E` gate), 6 Minor, fixed the same day on the maintainer's "fix the minors" (resolution at the end of the Minor list in that file; each code item fail-first).
- The release commit `7b0a61d` precedes the fix commit `c5df97a`; both are 0.4.0. Squash or keep as the maintainer prefers.
- Working tree: `.gitignore` carries an uncommitted line ignoring `/.claude/memory/` (auto-memory now lives in the repo via `.claude/settings.local.json`); not part of the branch. Commit it on `main` or the branch as wanted.

## Next (maintainer's call, all need credits)

1. Read the branch (`git diff main...feat/v0.4.0-usage-ledger`) and decide the run-end question under Open decisions (a proposal, not built).
2. `scripts/smoke.sh` (about 0.25 USD).
3. Eval suite, pinned like CI (about 6 USD, 9 cases). Watch the two replay-only graders `usage-ledger` (noncode-shortcircuit: `docs/megamaid/reviews/*-usage.md`; plan-native-planner: `.megamaid/usage/plan-*.md`) and `no-stray-file` from 0.3.1. Assumptions behind the ledger graders: a relative `$.fs.write` from the module lands in the eval workspace; the eval's `file_exists` glob matches a dot-directory. If one fails, drop that grader (the unit tests cover the module) and note it in `evals/README.md`.
4. Push on go; open the PR (CI runs the free gates on Linux: the §5 check now uses `[0-9]`, so GNU grep reads it).
5. **The measurement itself (Phase 2's point):** one ordinary `/megamaid:vacu-suck` on a code-shaped branch, "run again?" answered no. Read `<report>-usage.md`; record the orchestrator share of input and output tokens and the cost in this file and the ledger as the Phase 2 baseline; compare with the ideation estimate (orchestrator 20–35%; under 20% means only Phase 6 is worth doing for tokens). Three live confirmations while at it: the report was written with the Write tool (else no ledger: the spec's stated assumption); nested spawns reached the hook (an agent row's `Agents` equals the trace's Agent calls under that role); no agent turn ended before its spawn record landed (`Turns` not below `Agents`).

## Open decisions for the maintainer

- **Run end (a side agent's note, 2026-10-18; proposal, not built).** Today every main-loop turn until the next run or session end is counted, so chat after a run inflates the orchestrator row and the file keeps being rewritten. Proposed: a main-loop turn counts only when something of the run happened since the previous counted main-loop turn (a recorded spawn, a recorded agent's turn, or the report Write; the run's first main-loop turn always counts). Agent turns count as now. Effect: the ledger freezes after the turn that consumed the last agent result; a background agent's completion still counts the main-loop turn it raises; the cost line freezes with it. Build: one boolean on the run (`mainPending`), set by `startRun`, `agents.ts` (spawn) and `usage.ts` (agent turn, report Write), cleared when a main-loop turn is counted; three tests; the spec's Bound and one CHANGELOG sentence change. Cost if wrong: a mid-run plain-text question turn after a wave is not counted (its tokens are small). Until decided: read the ledger right after the run's final summary, or /clear before anything else.
- Whether a plan or fix run's ledger should also sit beside the report (spec chose `.megamaid/usage/` to avoid a per-lane heuristic).
- When to spend on steps 2–5.

## Decisions (Phase 2)

- Unattended session: the maintainer said "get this done" and "dont run the remote evals in this session". Spec, plan and reviews were run as the PLAYBOOK says, with the implementer deciding where the maintainer would have; every call is marked as such in the spec and the ledger.
- Placement beside the report kept (plan.md names it) over a single `.megamaid/usage/` location; cost: one observer hook, one basename test, one state field.
- `report` is set once per run: a sweep's "run again" is the same run, its ledger cumulative at the first report's place.
- Run end: next run or session end; no earlier signal is trustworthy (mid-run questions end main-loop turns too).
- Per-agent storage, per-key fold (Phase 5 pane needs the former).
- Nested spawns attributed to the parent role; a brief path inside a nested prompt is not parsed.
- One execution ruling: the backslash-path test asserts by suffix (the kit resolves non-POSIX paths against the plugin folder).
- Minors (maintainer's go): agents carry `seq` and rows sort by it; a stored run without `usage` is skipped; the `.catch` handlers log `usage hook failed: <message>` so guards are pinned without the exception path; §5 checks the three `.gitignore` writers; wording.

## Context a fresh session needs

- Everything in the 2026-10-14 handover still holds: comb baseline at `~/Development/comb-the-desert-claude-skill/evals/results/2026-10-12T01-29-43-961Z`; `expect` drives an interactive start to lay `.claude-plugin/types/`; kept eval dirs `/private/tmp/e-*`; `claude config get model` runs as a prompt (costs money); `claude plugin test` needs a fresh `CLAUDE_CONFIG_DIR` (check-contract does this); this machine's `git grep -E` has no `\b` (use `-w`); wait for `gh run list --branch` before `gh pr checks --watch`.
- Local Claude Code is now 2.1.302; vendored types and CI pin 2.1.299 (check-contract WARNs locally). Refresh with the `expect`-driven interactive start plus `scripts/sync-types.sh` as `chore(types)` when convenient.
- This machine's `grep` is ugrep (shell function) and `/usr/bin/grep` is BSD: both accept `\d`, GNU grep does not. Any pattern a gate shares between JavaScript and `grep -E` must be in the common dialect; §5 now refuses `\d`, `\w`, `\s`.
- The test kit resolves a relative `fs.write`/`fs.exists` path against the plugin folder before a test hook sees it (`test-rig.ts` strips the prefix); a test hook that throws is skipped by the kit (deny instead); a second `state.set` registration is refused by the rig.
- The kit prints a thrown plugin hook only under a failing test ("the engine reported: hook failed closed …"); nothing in the test's `$` exposes it, so a `.catch` that logs is how a guard becomes assertable. `on('state.get', …)` in a test seeds any run shape (the test `$` has no state noun).
- Account: about 2.5 USD was left on 2026-10-14; nothing was spent this session.
