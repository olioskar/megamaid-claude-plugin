# Fix mechanics in code (MM-028 step 1), with plan-order batches (MM-047)

Status: builder check done (2026-10-30); contract review settled (log below); for the maintainer's go. Branch `feat/fix-mechanics`. The maintainer's measure (2026-10-28): "we need to make sure megamaid does a perfect job"; on this spec (2026-10-29): "we need the orchestrator to be flexible still".

## Why

A fix round's mechanical steps are prose the orchestrator follows command by command: the git checks after an implementer, the revert after a FAIL, the verification compared with a baseline, the commit. Each has one right answer, and an orchestrator that improvises one gets it slightly wrong in a way nobody sees. Moving them into `megamaid.py` subcommands makes each exact and pinned by a fixture test, and spends fewer orchestrator tokens on them.

The orchestrator stays in charge. In the 2026-10-28 baseline it departed from the script four times; three were the orchestrator covering a hole in the skill or the script (MM-045, MM-047, MM-048), and two of those were right. So a command reports a verdict; it never decides the next step, and the orchestrator may override it with a stated reason.

## Decisions (the maintainer's, 2026-10-29)

1. **Step 1 only.** Code takes the mechanical steps; the orchestrator still drives the loop, dispatches every agent and makes every judgment call. Code running the loop (MM-028 step 2) is a later spec, after a probe of whether the module can drive agents through a whole run.
2. **All five steps move:** plan-order batches, the post-implementer git checks, revert with the attempt record, verification against the baseline, the commit.
3. **A verdict can be overridden.** The orchestrator may act against a command's verdict when it has a reason; it says so in the run's output.
4. **Overrides go in the end-of-run summary**, as an `Overrides:` list (`Overrides: none` when there were none).
5. **Items that touch the same file and declare no dependency keep severity order**, as today.
6. **With commits off, a later item on the same file runs** (2026-10-30, "run it, as you recommend"). A finished item's paths are the run's, not the user's: they are not folded into `D0`, so a later item that overlaps them is dispatched and checked against the tree the earlier item left. Today's prose folds them into `D0` and skips the later item (fix 4a, "its reported paths join `D0`"); that line goes.

## Calls made in the spec (the session's, for the maintainer to check)

1. **Group codes:** a `**Depends on:**` code that a group consolidated (`M4` inside `G1`) maps to the group through the group's `**Consolidates:**` header (`M4 + M5` or comma-separated), so the baseline's case (D1 on G1) is fixed without telling planners the group codes.
2. **`fix resync`:** after an override or the user's own git step (keeping an implementer's commit, a hand commit, a stash), the stored `HEAD_expected` and `D0` no longer match; `fix resync` re-reads `HEAD_expected`, and re-reads `D0` as the dirty tree minus the run's own paths, the finished items' paths and the in-flight write-sets it is given. It keeps the finished list. It is logged as an override. `fix start` mid-run is not a resync: it starts a new state. Without resync one override stops every later check.
3. **State keyed by the instruction folder,** not the run stem (no stem exists at Step 1.6): one state file per folder under `.megamaid/fix/`, written through `state_dir()` so `.megamaid/.gitignore` exists, overwritten by the next `fix start` on that folder; no change to `manifest.py`'s excerpt or clean contracts.
4. **git is required.** The fix skill already runs git at Steps 1.5 and 1.6, with commits on or off; the commands find a runnable git themselves (Constraints), so `fix-auto-on`'s commits-off scaffold still works; its scaffold comment ("so the case does not need git") is corrected.
5. **Snapshots for decision 6.** With commits off, a finished item's paths are recorded with their content (`git hash-object -w`, or `absent` for a path the item deleted). For a path in that list, "unchanged" means equal to the snapshot, and a revert restores the snapshot, not `HEAD`; for any other path both mean `HEAD`, as today. So a later item's revert keeps the earlier item's edit, and check 2 counts only what the later item changed.
6. **The run's own paths are the instruction folder and `paths.reviews`.** Today `D0` holds the review report and its ledger (fix Step 1.6) and only Step 1.5's question leaves `paths.reviews` out; here both sit with the run's own paths instead, which are in the allowed set, out of `D0` and out of the 1.5 list. Every check reads the same as today.

## Parts

Every command takes what it acts on on the call (codes, reported files, in-flight items, waiting items); none reads an earlier command's verdict or refuses because a step was skipped, so the orchestrator can correct an input and go on (decision 3). The state file holds only the baseline and, with commits off, the finished items.

| # | Part | What it does |
|---|---|---|
| 1 | `**Depends on:**` in plans | plan-brief gains an optional header line, `**Depends on:** <code>[, <code>…]`, written only when the plan's `## How` assumes another item's change is already in. The planner can see the other findings (`Report under planning:`). Absent or `none` means no dependency |
| 2 | `batches` honours it | A code consolidated into a group maps to the group (call 1). An item runs in a batch after every item it depends on, never in the same batch or an earlier one. Without dependencies the output is unchanged (severity order). A dependency on a code not in the folder, or on a not-reproduced item, prints `warning: <code> depends on <dep>, which is not queued` and is otherwise ignored; a cycle prints `warning: dependency cycle <codes>` and falls back to severity order for those items. Exit codes unchanged |
| 3 | `fix preflight` | Step 1.5's list, writing no state: `git status --porcelain` minus the run's own paths (call 6). Prints `preflight: clean` or one `dirty <path>` line each. The orchestrator asks the 1.5 question on a dirty list and acts on the answer (commit, stash, no commits, abort) before `fix start` |
| 4 | `fix start` | Step 1.6, after the 1.5 answer. Takes the verification command the orchestrator chose (review Step 5's rule; `none` records `verification: none configured`) and `--commits on\|off` (off when `fix.commit_per_item` is false or the 1.5 answer was "proceed without per-item commits"). Runs the verification first, then reads `HEAD_expected` and `D0` (the dirty tree minus the run's own paths), so files the verification writes are in `D0`. Records all of it in the state file (call 3) and prints one line per fact, then `not-dispatched <code>: <paths>` for each queued item whose write-set meets `D0`. `fix resync` (call 2) re-reads mid-run |
| 5 | `fix gate` | The not-dispatched rule for one item, for an item queued after `fix start` (a discovered `X` item): prints `gate <code>: ok` or `gate <code>: not-dispatched — <paths>` |
| 6 | `fix check` | Step 4d.1's three checks for one item, given its code, the reported files and the in-flight items: HEAD unchanged; the reported list equals the paths inside the item's write-set that changed (against `HEAD`, or a snapshot, call 5); nothing changed outside the allowed set (`D0`, the run's own paths, the finished paths, in-flight write-sets). Prints `check <code>: ok`, or `check <code>: stop-item — <why>` / `stop-batch — <why>` with the paths, as 4d.1 words them today |
| 7 | `fix revert` | Step 4f FAIL 1–2, given the code, the reported files and the in-flight items: restore each reported path (to `HEAD`, or its snapshot, call 5), delete a reported path that was absent there, confirm the write-set is unchanged, never touching another in-flight item's write-set; then append the `## Attempts` entry from the reviewer text and plan-change text the orchestrator passes. Prints what it restored, deleted and recorded |
| 8 | `fix verify` | Step 4f.0, given the PASSed items waiting and the items still under review: run the recorded command, compare with the baseline, attribute a new failure. Prints `verify: green`, `verify: red before the run (unchanged)`, `verify: fail <codes> — <lines>` (a failure naming a write-set fails that item, waiting or under review; one naming none fails every waiting item, not those under review, as 4f.0 today) or `verify: none configured` |
| 9 | `fix commit` | Step 4f.1, given the code, title, reported files and in-flight items. Commits on: stage the reported files, commit `<code>: <title>` (or the revise-doc message), advance `HEAD_expected`, check the tree is clean outside the allowed set; prints `commit <code>: <sha>`, or the failure with git's message. An empty reported list prints `commit <code>: skipped (no changes)`. Commits off: snapshot the reported paths as finished (call 5) and print `commit <code>: skipped (commits off)` |
| 10 | Fix skill | Steps 1.5, 1.6, 4d.1, 4f (FAIL 1–2), 4f.0, 4f.1 and the X-item queueing call the commands instead of spelling out git. A line per step: act on the verdict, or override it with a reason, logged `override <step> <code>: <verdict> → <what was done> — <why>`. Step 5's summary and every halt status list (4a batch stop, three FAILs in 4f, a commit failure in 4f.1) gain `Overrides:`. 4a's "its reported paths join `D0`" goes (decision 6); the definitions follow: the run's own paths (Step 1.6, call 6), the allowed set (4a, plus the finished paths), and "changed" in 4d.1 check 2 and the 4f revert (against `HEAD` or a snapshot, call 5). Inputs' execution order names `batches`' order. Ground rule "Git is the orchestrator's" stays; the orchestrator's git goes through these commands |
| 11 | vacu-suck | Its fixed order (Critical → … → Discovered, `skills/vacu-suck/SKILL.md:103`) becomes `batches`' order, so a sweep honours dependencies; its summary gains `Overrides:` |

## Constraints

- **Stdlib Python, run like the rest of `megamaid.py`:** `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" …` from the project root; output is fixed-format lines, pinned by `scripts/test-megamaid.sh` fixtures (temporary git repos under the test's temp cwd).
- **git on macOS in the eval sandbox:** `/usr/bin/git` is Apple's shim and fails there (evals/README.md); the agent finds `/opt/homebrew/bin/git` itself. The commands must find a git that runs (first of `git` on `PATH`, `/opt/homebrew/bin/git`, `/usr/local/bin/git` whose `--version` exits 0) and exit 2 naming the problem when none does. `project_root_default` falls back to cwd silently today; the fix commands must not.
- **No hooks.** Nothing forces the orchestrator to call these commands (decision 3); the call-time guards are unchanged.
- **State file:** under `.megamaid/fix/`, through `state_dir()` (call 3). In-flight items are passed per call, because which items are in flight is the orchestrator's judgment (it may split a batch).
- **Moving text moves its checks.** Named, so none goes stale:
  - Evals: `fix-reviewer-diff-scope`'s `head-recorded`, `tree-checked`, `two-commits` and `verification-before-commit` count raw git and test commands in the trace; they go, graders on the new calls take their place, and a `regex` grader on `last_message` checks `Overrides:` (decision 4). `reviewer-never-head-tilde` stays. `scripts/test-replay.sh` and its `fix-pass`, `fix-fail` fixtures follow; `evals/README.md`'s case rows and grader notes; `evals/fix-auto-on/scaffold.sh`'s comment (call 4).
  - Gate: a check-contract needle that the fix skill calls `megamaid.py" fix`, beside the one for `batches`.
  - Docs: `docs/features/fix.md` (pre-flight, batches, the one-item table, FAIL, without per-item commits, summary, vacu-suck's fixed execution order), `docs/api/working-paths.md` (a row for the state file under `.megamaid/fix/`, never removed, overwritten by the next `fix start` on its folder; and a line that commits-off snapshots write loose objects into the project's `.git/objects`, which git's garbage collection removes), `docs/features/plan.md` (the header list gains `Depends on`), `docs/api/scripts.md` (the new commands), `megamaid.py`'s docstring (the command list; `batches`' severity order).
- Gates: `scripts/check-contract.sh` ends `check-contract: OK`; `claude plugin validate .` passes with the accepted warning.

## Left to the builder

- Subcommand and flag spelling (`fix preflight` / `fix start` / `fix gate` / `fix check` / `fix resync` … are working names), the state file's name and format, the exact wording of each output line beyond the shapes above.
- How `fix verify` extracts failing lines and paths, as long as it matches today's 4f.0 rules.
- Which eval graders replace the four raw-git ones, and their counts.
- Whether `fix revert` takes the reviewer text by argument or by file.

## Bounds

- The orchestrator can still run git itself; only the prose and the summary's `Overrides:` list say when it should not. A departure that is not logged is not caught.
- A planner that omits `**Depends on:**` gets severity order, as today; the orchestrator's reorder is the backstop.
- The orchestrator's token saving is unmeasured; the next live run's ledger shows it against the baseline in [costs](../knowledge/costs.md).

## Checks (what done looks like)

- `test-megamaid.sh` cases: `batches` with a dependency, an unknown dependency, a cycle, and none (unchanged output); a dependency on a grouped code; on a temporary repo: `fix preflight` with only the run's own paths dirty (clean); `fix start` with verification that writes a file (in `D0`) and an item meeting `D0` (not-dispatched); `fix gate`; `fix check` for a moved HEAD, an unreported changed file, a path outside the allowed set, and a sweep's dirty report under `paths.reviews` (ok); `fix revert` leaving a batch-mate's file alone, and with commits off keeping an earlier same-file item's edit; `fix verify` red-unchanged, a new failure on a write-set, and one naming none with an item under review (not failed); `fix commit` for an empty list, a pre-commit hook that refuses, and commits off; `fix resync` after a hand commit keeping the finished list; no runnable git.
- `test-replay.sh` holds the new fix graders and the `Overrides:` grader, passing and failing.
- Paid, each on the maintainer's word: smoke, the `fix-reviewer-diff-scope` and `fix-auto-on` cases, the full suite before the PR.

## Review log

Contract round 1 (2026-10-30): decision 6 against revert and check 2 → snapshots (call 5); `paths.reviews` out of `D0` but not allowed → the run's own paths (call 6); 1.5 and 1.6 order, the answers, commits off → `fix preflight`, `fix start` after the answer with `--commits`; the not-dispatched rule → `fix start` lines and `fix gate`; resync folding finished paths → resync keeps them (call 2); inputs on the call, waiting vs reviewing, empty list → the Parts preamble, parts 8 and 9; stale text → parts 10, 11 and Constraints; no gate for `Overrides:` → a grader and a needle; Part 3 keyed by stem → folder; `.gitignore` writer → `state_dir()`. Re-check: all ten closed; the skill's term definitions and `working-paths.md` named. None open.
