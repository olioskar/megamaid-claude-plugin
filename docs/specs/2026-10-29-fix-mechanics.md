# Fix mechanics in code (MM-028 step 1), with plan-order batches (MM-047)

Status: builder check done (2026-10-30); the contract review, then the maintainer's go. Branch `feat/fix-mechanics`. The maintainer's measure (2026-10-28): "we need to make sure megamaid does a perfect job"; on this spec (2026-10-29): "we need the orchestrator to be flexible still".

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
2. **`fix resync`:** after an override or the user's own git step (keeping an implementer's commit, a hand commit, a stash), the stored `HEAD_expected` and `D0` no longer match; `fix resync` re-reads them from the repo and is logged as an override. Without it one override stops every later check.
3. **State keyed by the instruction folder,** not the run stem (no stem exists at Step 1.6): one state file per folder under `.megamaid/fix/`, overwritten by the next `fix start` on that folder; no change to `manifest.py`'s excerpt or clean contracts.
4. **git is required.** The fix skill already runs git at Steps 1.5 and 1.6, with commits on or off; the commands find a runnable git themselves (Constraints), so `fix-auto-on`'s commits-off scaffold still works.

## Parts

| # | Part | What it does |
|---|---|---|
| 1 | `**Depends on:**` in plans | plan-brief gains an optional header line, `**Depends on:** <code>[, <code>…]`, written only when the plan's `## How` assumes another item's change is already in. The planner can see the other findings (`Report under planning:`). Absent or `none` means no dependency |
| 2 | `batches` honours it | A code consolidated into a group maps to the group (call 1). An item runs in a batch after every item it depends on, never in the same batch or an earlier one. Without dependencies the output is unchanged (severity order). A dependency on a code not in the folder, or on a not-reproduced item, prints `warning: <code> depends on <dep>, which is not queued` and is otherwise ignored; a cycle prints `warning: dependency cycle <codes>` and falls back to severity order for those items. Exit codes unchanged |
| 3 | `fix start` | Step 1.6 in one call. Records the run baseline in a state file under `.megamaid/` keyed by the run stem: `HEAD_expected`, the dirty baseline `D0` (excluding the run's own paths and `paths.reviews`), the verification command the orchestrator chose and its baseline result (exit code, failing lines). Prints one line per fact. `fix resync` re-reads `HEAD_expected` and `D0` (call 2). The orchestrator still chooses the command (review Step 5's rule) and passes it; `none` records `verification: none configured`. Step 1.5's dirty-tree list comes from the same exclusion rule |
| 4 | `fix check` | Step 4d.1's three checks for one item, given its code, the implementer's reported files and the in-flight items: HEAD unchanged; reported list equals the dirty paths inside the item's write-set; nothing dirty outside the allowed set (D0, the run's own paths, finished items' paths when commits are off, in-flight write-sets). Prints `check <code>: ok`, or `check <code>: stop-item — <why>` / `stop-batch — <why>` with the paths, as 4d.1 words them today |
| 5 | `fix revert` | Step 4f.1–2: restore the item's reported tracked files, delete its reported untracked ones, confirm its write-set is clean, never touching another in-flight item's write-set; then append the `## Attempts` entry from the reviewer text and plan-change text the orchestrator passes. Prints what it restored, deleted and recorded |
| 6 | `fix verify` | Step 4f.0: run the recorded command, compare with the baseline, attribute a new failure to in-flight write-sets. Prints `verify: green`, `verify: red before the run (unchanged)`, `verify: fail <codes> — <lines>` or `verify: none configured` |
| 7 | `fix commit` | Step 4f.1 with commits on: stage the reported files, commit `<code>: <title>` (or the revise-doc message), advance `HEAD_expected` in the state file, then check the tree is clean outside the allowed set. Prints `commit <code>: <sha>`, or the failure with git's message. With commits off it records the item's reported paths as the run's (decision 6) and prints `commit <code>: skipped (commits off)` |
| 8 | Fix skill | Steps 1.5, 1.6, 4d.1, 4f (FAIL steps 1–2), 4f.0 and 4f.1 call the commands instead of spelling out git. A line per step: act on the verdict, or override it with a reason, logged `override <step> <code>: <verdict> → <what was done> — <why>`. Step 5's summary gains `Overrides:`. Ground rule "Git is the orchestrator's" stays; the orchestrator's git now goes through these commands |

## Constraints

- **Stdlib Python, run like the rest of `megamaid.py`:** `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" …` from the project root; output is fixed-format lines, pinned by `scripts/test-megamaid.sh` fixtures (temporary git repos under the test's temp cwd).
- **git on macOS in the eval sandbox:** `/usr/bin/git` is Apple's shim and fails there (evals/README.md); the agent finds `/opt/homebrew/bin/git` itself. The commands must find a git that runs (first of `git` on `PATH`, `/opt/homebrew/bin/git`, `/usr/local/bin/git` whose `--version` exits 0) and exit 2 naming the problem when none does. `project_root_default` falls back to cwd silently today; the fix commands must not.
- **No hooks.** Nothing forces the orchestrator to call these commands (decision 3); the call-time guards are unchanged.
- **State file:** under `.megamaid/fix/` (`.megamaid/` is already gitignored by `megamaid.py`), keyed by the instruction folder (call 3). It holds what the orchestrator would otherwise carry in context (HEAD_expected, D0, the verification command and baseline, finished items' paths when commits are off); in-flight items are passed per call, because which items are in flight is the orchestrator's judgment (it may split a batch).
- **Moving text moves its checks.** `fix-reviewer-diff-scope`'s `head-recorded`, `tree-checked`, `two-commits` and `verification-before-commit` count raw git and test commands in the trace; they go, and graders on the new calls take their place, pinned by `scripts/test-replay.sh` fixtures. `reviewer-never-head-tilde` stays.
- Gates: `scripts/check-contract.sh` ends `check-contract: OK`; `claude plugin validate .` passes with the accepted warning.

## Left to the builder

- Subcommand and flag spelling (`fix start` / `fix check` / `fix resync` … are working names), the state file's name and format, the exact wording of each output line beyond the shapes above.
- How `fix verify` extracts failing lines and paths, as long as it matches today's 4f.0 rules.
- Which eval graders replace the four raw-git ones, and their counts.
- Whether `fix revert` takes the reviewer text by argument or by file.

## Bounds

- The orchestrator can still run git itself; only the prose and the summary's `Overrides:` list say when it should not. A departure that is not logged is not caught.
- A planner that omits `**Depends on:**` gets severity order, as today; the orchestrator's reorder is the backstop.
- The orchestrator's token saving is unmeasured; the next live run's ledger shows it against the baseline in [costs](../knowledge/costs.md).

## Checks (what done looks like)

- `test-megamaid.sh` cases: `batches` with a dependency, an unknown dependency, a cycle, and none (unchanged output); a dependency on a grouped code; each `fix` command on a temporary repo for its verdicts, including a moved HEAD, a `fix resync` after a hand commit, a later same-file item with commits off, an unreported dirty file, a path outside the allowed set, a revert that leaves a batch-mate's file alone, a red-unchanged and a new-failure verification, a commit that a pre-commit hook refuses, and no runnable git.
- `test-replay.sh` holds the new fix graders, passing and failing.
- Paid, each on the maintainer's word: smoke, the `fix-reviewer-diff-scope` and `fix-auto-on` cases, the full suite before the PR.
