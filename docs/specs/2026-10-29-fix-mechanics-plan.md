# Fix mechanics in code: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `megamaid.py fix` commands that do a fix round's mechanical steps exactly, plan-order batches, and a fix skill that calls them while the orchestrator keeps every judgment and may override any verdict.

**Architecture:** The commands live in a new `scripts/fixrun.py`, loaded by `megamaid.py` the way `migrate.py` is (by file path; `python3 -I` drops the script's directory from `sys.path`). `megamaid.py` parses the `fix` subcommands and hands `fixrun.run(a, ctx)` the merged config and its write-set reader. `batches` gains dependency order in `megamaid.py` itself. Fix and vacu-suck prose call the commands.

**Tech Stack:** Python 3 stdlib, git, bash fixture tests, `claude plugin eval` graders.

**Spec:** [2026-10-29-fix-mechanics.md](2026-10-29-fix-mechanics.md). Read it first; this plan does not repeat its reasons or its decisions.

## Global Constraints

- Stdlib only; run as `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix <cmd> …` from the project root; fixed-format stdout lines; a verdict exits 0, a usage or environment error exits 2 through `die`.
- git: first of `git` on `PATH`, `/opt/homebrew/bin/git`, `/usr/local/bin/git` whose `--version` exits 0; none → exit 2 `megamaid.py: no runnable git (tried: …)`.
- Paths are repo-relative (`git rev-parse --show-toplevel`), read with `git status --porcelain=v1 -z -uall` so names with spaces, renames and new folders' files come through whole.
- The run's own paths: the instruction folder and `paths.reviews` (from the merged config), both repo-relative prefixes.
- State: `.megamaid/fix/<folder slug>.json` through `state_dir()` (which writes `.megamaid/.gitignore`); `slugify` as `report-name` uses it.
- Every input a command acts on comes on the call; no command reads an earlier verdict.
- `megamaid.py` docstring is the CLI contract; each new command gets its paragraph there and a row in `docs/api/scripts.md`.
- Commits `type(scope): summary`, by path; each task's test written first and seen to fail; `bash scripts/test-megamaid.sh` and `scripts/check-contract.sh` pass at every commit.

## Review Focus

1. A path with a space, a rename (`R old -> new`) and a new folder's files come through as whole repo-relative paths. Test in Task 2 (`fix-preflight-oddpaths`).
2. Run from a subdirectory of the repo, every command resolves paths against the top level. Test in Task 2 (`fix-start-subdir`).
3. A verification that exits non-zero but prints no line that looks like a failure still reads as red, every non-empty line taken as failing. Test in Task 5 (`fix-verify-silent-red`).
4. A reported path the implementer deleted (tracked, now missing) counts as changed, and the revert brings it back. Test in Task 4 (`fix-revert-deleted`).
5. A state file missing or written for another folder exits 2 naming `fix start`, never a traceback. Test in Task 3 (`fix-check-nostate`).

## Files

| File | Change |
|---|---|
| `scripts/fixrun.py` (new) | every `fix` command; git finder; state file |
| `scripts/megamaid.py` | `fix` subparsers and `load_fixrun()`; `batches` dependency order; docstring |
| `scripts/test-megamaid.sh` | `mkrepo` helper (temp git repo from a fixture tree) and the cases below; expected files under `scripts/fixtures/megamaid/expected/` |
| `scripts/fixtures/megamaid/project/plans/{deps,depgroup,depcycle}/`, `scripts/fixtures/megamaid/fixrepo/` | fixture plans and a repo template |
| `shared/plan-brief.md`, `skills/plan/SKILL.md` | `**Depends on:**` |
| `skills/fix/SKILL.md`, `skills/vacu-suck/SKILL.md` | calls, overrides, `Overrides:` |
| `scripts/check-contract.sh` | needle for `megamaid.py" fix` |
| `evals/fix-reviewer-diff-scope/graders/`, `scripts/test-replay.sh`, `scripts/fixtures/replay/fix-{pass,fail}/out/trace.jsonl`, `evals/README.md`, `evals/fix-auto-on/scaffold.sh` | graders |
| `docs/features/{fix,plan}.md`, `docs/api/{scripts,working-paths}.md`, `CHANGELOG.md` | docs |

---

### Task 1: `**Depends on:**` and dependency-ordered batches (parts 1, 2, 11)

**Files:** `scripts/megamaid.py` (`make_batches`, `cmd_batches`, docstring), `shared/plan-brief.md:31`, `skills/plan/SKILL.md`, `skills/vacu-suck/SKILL.md:103`, `skills/fix/SKILL.md:24`, `docs/features/plan.md`, `docs/api/scripts.md`, `scripts/test-megamaid.sh`, fixtures.

**Interfaces:** Produces `depends_of(text) -> list[str]` (codes from `**Depends on:**`, split on `,` or `+`, `none` → `[]`) and `consolidates_of(text) -> list[str]` (same rule on `**Consolidates:**`); `make_batches(items, deps)` where `deps: dict[str, list[str]]` holds resolved codes. `batches`' output keeps its line shapes, gaining only the two warnings.

- [ ] **Step 1:** Fixtures: `plans/deps/` with `M1-a.md` (`src/a.ts`), `H1-b.md` (`src/a.ts`, `**Depends on:** M1`), `L1-c.md` (`src/c.ts`, `**Depends on:** Z9`); `plans/depgroup/` with `G1-g.md` (`**Consolidates:** M4 + M5`, `src/g.ts`) and `D1-d.md` (`src/g.ts`, `**Depends on:** M4`); `plans/depcycle/` with `M1` ↔ `M2` depending on each other on different files. Expected: `batches-deps` puts `M1` in a batch before `H1` (severity alone would put `H1` first) and prints `warning: L1 depends on Z9, which is not queued`; `batches-depgroup` puts `G1` before `D1` (severity alone: `D1` first); `batches-depcycle` prints `warning: dependency cycle M1 M2` and the severity batches. Every existing `batches-*` expected file is unchanged.
- [ ] **Step 2:** `bash scripts/test-megamaid.sh` fails on the three new cases only.
- [ ] **Step 3:** Implement. The order: severity order as today, then repeatedly take the first pending item whose dependencies are all in earlier batches; an item never joins a batch holding one of its dependencies. A dependency on a not-reproduced code warns like an unknown one.
- [ ] **Step 4:** Prose: plan-brief's header block gains `**Depends on:** {codes of the findings whose fix this plan's How assumes is already in | none}` after `**Consolidates:**`, with one sentence on when to write it; `skills/plan/SKILL.md`'s planner prompt says the same once; vacu-suck:103 and fix Inputs (:24) say the order is `batches`' order; `docs/features/plan.md`'s header list; the docstring's `batches` paragraph and `docs/api/scripts.md`'s row.
- [ ] **Step 5:** test-megamaid and check-contract pass. Commit `feat(scripts): batches honour a plan's Depends on (MM-047)`.

### Task 2: `fixrun.py`, the git finder, state, `fix preflight`, `fix start`, `fix gate`, `fix resync` (parts 3, 4, 5)

**Files:** new `scripts/fixrun.py`, `scripts/megamaid.py` (`load_fixrun`, parsers, docstring), `scripts/test-megamaid.sh`, `scripts/fixtures/megamaid/fixrepo/` (a small tree with `src/a.js`, `src/b.js`, `plans/p/M1-a.md` writing `src/a.js`, `plans/p/M2-b.md` writing `src/b.js`, `docs/megamaid/reviews/`), `docs/api/scripts.md`.

**Interfaces (produced):**
- CLI, all with `--folder <instruction folder>` and the config flags: `fix preflight`; `fix start --verify "<cmd>"|none --commits on|off`; `fix gate --code <c>`; `fix resync [--in-flight <codes>…]`.
- Output: `preflight: clean` or `dirty <path>` per line; `fix start`: `head: <sha>`, `d0: <paths space-separated>|none`, `verification: green|red (<n> failing lines)|none configured`, `commits: on|off`, then `not-dispatched <code>: <paths>` per item; `gate <code>: ok|not-dispatched — <paths>`; `fix resync`: `head:`, `d0:` as for start.
- `fixrun.py`: `run(a, ctx)` with `ctx = {"cfg": merged config, "write_sets": folder -> dict[code, list[path]]}`; `find_git() -> str`; `repo_root(git) -> str`; `dirty(git, root) -> list[str]`; `own_paths(root, folder, cfg) -> list[str]`; `load_state(root, folder) -> dict` (exit 2 `no fix state for <folder>; run megamaid.py fix start first` when absent or for another folder); `save_state(root, folder, st)`. State keys: `folder`, `head`, `d0`, `verify` (`{cmd, exit, failing}` or null), `commits`, `finished` (`{path: blob|"absent"}`).
- `fix start` runs the verification (`subprocess.run(cmd, shell=True, cwd=root)`, stdout and stderr together) before reading `d0`. `failing_lines(output, exit) -> list[str]`: lines matching `(?i)\b(fail|failed|failing|error|not ok)\b` or starting `✗`; when exit ≠ 0 and none match, every non-empty line.

- [ ] **Step 1:** `test-megamaid.sh` gains `mkrepo <name>` (copy the fixture tree to `$T/<name>`, `git init -q -b main`, commit) and cases: `fix-nogit` (`PATH` without git and `MEGAMAID_GIT_CANDIDATES=/nonexistent` → exit 2; the env var overrides the two fallback paths, for this test only, and is named in the docstring); `fix-preflight-clean` (only `plans/p/` and `docs/megamaid/reviews/` dirty → `preflight: clean`); `fix-preflight-oddpaths` (an untracked `notes/x y.txt`, a renamed `src/b.js` → `src/b2.js` → `dirty notes/x y.txt`, `dirty src/b.js`, `dirty src/b2.js`); `fix-start` (`--verify "sh -c 'echo built > out.txt'"`: `d0: out.txt`, `verification: green`); `fix-start-notdispatched` (dirty `src/a.js` → `not-dispatched M1: src/a.js`); `fix-start-subdir` (run from `$T/<repo>/src` → same lines as from the root); `fix-gate`; `fix-resync` (a hand commit after start → new `head:`, `d0: none`).
- [ ] **Step 2:** Fails (no `fix` subcommand).
- [ ] **Step 3:** Implement `fixrun.py`'s finder, root, dirty reader, state and the four commands; `megamaid.py` gains `load_fixrun()` (copy of `load_migrate`'s shape) and a `fix` subparser group dispatching to `fixrun.run`; docstring paragraphs; `docs/api/scripts.md` rows.
- [ ] **Step 4:** Pass. Commit `feat(scripts): fix start, preflight, gate and resync`.

### Task 3: `fix check` (part 6)

**Interfaces:** `fix check --folder F --code C --reported <paths>… [--in-flight <codes>…]` → `check C: ok`, `check C: stop-item — <why>`, `check C: stop-batch — <why>`. Reasons, worded as 4d.1: `HEAD moved during implementer (<old> → <new>)` (stop-batch); `<paths> changed but not reported` / `<paths> reported but unchanged` (stop-item); `<path> reported outside ## Where` (stop-item, or stop-batch when inside an `--in-flight` item's write-set); `<paths> changed outside every in-flight write-set (<codes>)` (stop-batch). `changed(git, root, st, paths) -> set[str]` (porcelain; Task 6 adds snapshots).

- [ ] **Step 1:** Cases on a started repo: `fix-check-ok`; `fix-check-head` (a commit after start); `fix-check-unreported`; `fix-check-outside-where`; `fix-check-outside-allowed`; `fix-check-sweep` (a dirty report under `docs/megamaid/reviews/` → ok); `fix-check-nostate` (no `fix start` → exit 2 naming it).
- [ ] **Step 2:** Fail. **Step 3:** Implement. **Step 4:** Pass. Commit `feat(scripts): fix check`.

### Task 4: `fix revert` (part 7)

**Interfaces:** `fix revert --folder F --code C --reported <paths>… [--in-flight <codes>…] --reviewer-file <path> [--plan-change "<text>"]` (plan-change defaults to `none`). Restores each reported path to `HEAD` (`git checkout HEAD -- <p>` for a tracked path, delete for one absent at `HEAD`), refuses a path inside another `--in-flight` write-set (`skipped <p> — in <code>'s write-set`), confirms the write-set is unchanged, appends `### Attempt <n> — FAIL` with `**Reviewer:**` (the file's text) and `**Plan change:**` under `## Attempts` (created on the first). Prints `restored <p>`, `deleted <p>`, `skipped …`, `attempt <n> recorded`, then `revert C: clean` or `revert C: dirty — <paths>`.

- [ ] **Step 1:** Cases: `fix-revert` (an edited file and a new file → restored, deleted, attempt 1); `fix-revert-batchmate` (a reported path in M2's write-set with `--in-flight M2` → skipped, untouched); `fix-revert-deleted` (a tracked file removed → restored); `fix-revert-second` (attempt 2 appended after attempt 1).
- [ ] **Step 2:** Fail. **Step 3:** Implement. **Step 4:** Pass. Commit `feat(scripts): fix revert records the attempt`.

### Task 5: `fix verify` (part 8)

**Interfaces:** `fix verify --folder F [--waiting <codes>…] [--reviewing <codes>…]` → `verify: green`, `verify: red before the run (unchanged)`, `verify: fail <codes> — <first new failing line>` (then one `line <text>` per new failing line), or `verify: none configured`. A new failing line naming a path in a waiting or reviewing item's write-set fails that item; one naming none fails every waiting item and no reviewing one.

- [ ] **Step 1:** Cases with `--verify` set to small `sh -c` scripts: `fix-verify-green`; `fix-verify-unchanged` (red at start, same lines); `fix-verify-attributed` (a new line naming `src/a.js`, M1 reviewing, M2 waiting → `fail M1`); `fix-verify-unattributed` (a new line naming `test/x.test.js`, M1 waiting, M2 reviewing → `fail M1`); `fix-verify-silent-red` (exit 1, output `oops` → red, `oops` failing); `fix-verify-none`.
- [ ] **Step 2:** Fail. **Step 3:** Implement. **Step 4:** Pass. Commit `feat(scripts): fix verify against the run baseline`.

### Task 6: `fix commit`, and snapshots with commits off (part 9, call 5)

**Interfaces:** `fix commit --folder F --code C --title "<t>" --reported <paths>… [--in-flight <codes>…]` → `commit C: <sha>`, `commit C: skipped (no changes)`, `commit C: skipped (commits off)`, `commit C: failed — <git's first stderr line>`, `commit C: tree not clean — <paths>`. Message `<C>: <t>`; for a `revise-<stem>` code, `revise <stem>: apply review revisions`. Commits on: `git add -- <reported>`, `git commit -m`, update `head`, then the clean check. Commits off: `finished[p] = git hash-object -w <p>` or `"absent"`. `changed` (Task 3) and the revert (Task 4) read `finished`: a path in it is changed when its blob differs or its existence does, and is restored to the blob.

- [ ] **Step 1:** Cases: `fix-commit` (sha printed, `head` advanced so a following `fix check` is ok); `fix-commit-empty`; `fix-commit-hook` (a `pre-commit` hook exiting 1 → `failed —`); `fix-commit-revise`; `fix-commit-off` then `fix-check-off-later` (M3 on `src/a.js` after M1 finished on it, commits off: reported `src/a.js` → ok; unreported → `changed but not reported` only for M3's own edit) and `fix-revert-off-later` (M3's revert leaves M1's edit in `src/a.js`).
- [ ] **Step 2:** Fail. **Step 3:** Implement. **Step 4:** Pass. Commit `feat(scripts): fix commit, with snapshots when commits are off`.

### Task 7: The fix skill and vacu-suck call the commands (parts 10, 11)

**Files:** `skills/fix/SKILL.md`, `skills/vacu-suck/SKILL.md`, `scripts/check-contract.sh` (needle beside :105), `docs/features/fix.md`, `docs/api/working-paths.md`, `evals/fix-auto-on/scaffold.sh:3-4`, `CHANGELOG.md`.

- [ ] **Step 1: Check:** add the needle `grep -Fq 'megamaid.py" fix ' skills/fix/SKILL.md || { echo "FAIL: skills/fix does not invoke megamaid.py fix"; fail=1; }`; check-contract fails.
- [ ] **Step 2:** Rewrite per spec part 10: Step 1.5 runs `fix preflight` and asks on its `dirty` lines; Step 1.6 runs `fix start` after the answer and skips the items it lists `not-dispatched`; the run's own paths (Step 1.6) are the folder and `paths.reviews`; 4a's allowed set adds the finished paths and drops "its reported paths join `D0`"; 4d.1 is `fix check`; an X item is queued through `fix gate`; 4f FAIL 1–2 is `fix revert` (the orchestrator writes the reviewer text to a temp file under `.megamaid/`); 4f.0 is `fix verify`; 4f.1 is `fix commit`. One paragraph after 4a: a verdict is the default; the orchestrator may act otherwise with a reason, logs `override <step> <code>: <verdict> → <what was done> — <why>`, and runs `fix resync` after any git step of its own or the user's. Step 5's summary, the 4a batch-stop list, the three-FAILs list and the 4f.1 commit-failure list end with `Overrides: <one per line> | none`. vacu-suck's summary gains the same line. Ground rule "Git is the orchestrator's" reads: through the `fix` commands.
- [ ] **Step 3:** Docs: features/fix.md (pre-flight, batches, the one-item table, FAIL, without per-item commits, summary, vacu-suck's order); working-paths.md (the state file row; commits-off snapshots write loose objects to `.git/objects`); fix-auto-on's scaffold comment; CHANGELOG `[Unreleased]` (Added: the commands, `Depends on`; Changed: fix and vacu-suck use them, overrides listed; Fixed: MM-047, and with commits off a later same-file item runs instead of being skipped).
- [ ] **Step 4:** check-contract passes (the needle, §3 shared-block needles). Commit `feat(skills): fix runs its mechanical steps through megamaid.py fix`.

### Task 8: Graders follow the steps (spec Constraints)

**Files:** `evals/fix-reviewer-diff-scope/graders/` (delete `head-recorded`, `tree-checked`, `two-commits`, `verification-before-commit`; add below), `scripts/fixtures/replay/fix-{pass,fail}/out/trace.jsonl`, `scripts/test-replay.sh`, `evals/README.md`.

New graders (`tool_used` on Bash unless said): `fix-started` (`megamaid\.py"? fix start`, min 1); `fix-checked` (`fix check`, min 2); `fix-verified` (`fix verify`, min 2); `m1-committed`, `m2-committed` (`regex`, target `trace`, `commit M1: [0-9a-f]{7,}` and `commit M2: …`); `overrides-listed` (`regex`, `last_message`, `Overrides:`).

- [ ] **Step 1:** Rewrite the two replay traces: `fix-pass` with the new calls and their results and a final message carrying `Overrides: none`; `fix-fail` with raw git calls and no `Overrides:`. `test-replay.sh` expects `✓`/`✗` for each new grader and drops the four old names.
- [ ] **Step 2:** `bash scripts/test-replay.sh` fails before the grader files exist, passes after.
- [ ] **Step 3:** evals/README.md's `fix-reviewer-diff-scope` row and the grader-count note (:17).
- [ ] **Step 4:** check-contract passes. Commit `test(evals): grade the fix commands, not raw git`.

## After the tasks (dev-flow 6–7)

Branch review by fresh subagents (contract; code and tests). Free gates. Paid, each on the maintainer's word: smoke (about 0.25 USD); `fix-reviewer-diff-scope` and `fix-auto-on` alone (about 1.3 USD); the full suite before the PR (about 5 USD).
