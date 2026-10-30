---
name: fix
description: Use after /megamaid:plan has produced instruction files and the user wants them executed. The user must invoke this explicitly — Claude does not auto-trigger it because it edits code.
argument-hint: "[instruction-folder] [focus brief]"
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

You are running step 3 of the megamaid workflow: review → plan → fix.

You're a team lead working through a stack of fix instructions. For each: hand it to an implementer, then hand the result to a reviewer. If it fails, adjust and retry. Track progress; don't let anything slip.

## Inputs

1. **Folder of instruction documents** — from `/megamaid:plan` or any structured fix instructions. User specifies, or default to most recent under `<paths.plans>`.
2. **Execution order** — user specifies (e.g., "C1 → H1-H3 → M1-M10"), or the `batches` order (Step 2.5): Critical → High → Medium → Low → Test gaps, an item after those its plan names on `**Depends on:**`. Confirm with user. Exclude items the user marks deferred or out-of-scope.
3. **Focus brief** — `$ARGUMENTS` — carries through from review when invoked via `/megamaid:vacu-suck`.

## Step 1: Load config

Load the merged config per `${CLAUDE_PLUGIN_ROOT}/shared/config-loading.md`:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" config
```

Run it — like every `megamaid.py` command line in this skill — from the project root, and read its JSON output; it is the merged config. A non-zero exit names the bad file — stop and show it.

From it:
- `models.fix.implementer_standard`
- `models.fix.implementer_trivial`
- `models.fix.reviewer`
- `models.plan` and `paths.base_branch` (for the X-item planner dispatch, Step 4f)
- `paths.reviews` (the review reports, which Step 1.5 does not count as uncommitted work)
- `directives` and `agents` (for verifier dispatch)
- `paths.patterns` — the PATTERNS manifest, if it resolves

**Load the PATTERNS manifest.** If `paths.patterns` resolves, record its path; do not read it. The excerpt is cut after Step 2.5 (below), which is after the pre-flight. If absent or `null`, skip — graceful no-op.

## Step 1.5: Pre-flight — check for an unrelated dirty tree

Skip this entire step if `fix.commit_per_item` is `false` in merged config.

Run:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix preflight --folder <instruction folder>
```

It lists the dirty tree minus the run's own paths (Step 1.6): in `/megamaid:vacu-suck` the round's report and plans are always there and are not the user's work. `preflight: clean` → proceed.

On `dirty <path>` lines, surface a one-shot question with these options:

```
Working tree has uncommitted changes before /megamaid:fix starts:
  <the dirty paths>

Pick one:
  (a) Commit existing changes now (suggest a message)
  (b) Stash and restore at the end of the run
  (c) Proceed without per-item commits for this run only
  (d) Abort
```

Honor the user's choice (commit or stash it yourself), then proceed to Step 1.6. In `/megamaid:vacu-suck`, this question is the third allowed question (alongside scope-at-start and run-again-at-end), and only fires when the tree is dirty.

## Step 1.6: Record the run baseline

Three facts, recorded once here, after Step 1.5's answer, and compared against by Steps 4d.1, 4f.0, and 4f.1. Record them whether or not Step 1.5 ran. Choose the verification command the way `/megamaid:review` Step 5 chooses it: commands named in `CLAUDE.md`, else the project's build or package manifest(s); `none` when neither names one. Commits are `off` when `fix.commit_per_item` is `false` or the Step 1.5 answer was (c), else `on`. Then run:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix start --folder <instruction folder> --verify "<command>" --commits on|off
```

It runs the verification first, then records:

- **Verification baseline** — its exit code and failing lines (`verification: green`, `red (<n> failing lines)`, or `none configured`, after which 4f.0 skips). When it is red before any item runs, ask once: proceed (a 4f.0 failure whose failing lines are these is not the item's) or abort. In `/megamaid:vacu-suck` this is logged, not asked; the sweep proceeds.
- **Dirty baseline `D0`** (`d0:`) — the dirty tree as it stands after that run (so artefacts the verification wrote are in it), minus the run's own paths. Paths in `D0` are the user's and are never re-examined by this run's checks. An item whose write-set meets `D0` is listed `not-dispatched <code>: <paths>`: do not dispatch it; announce `{code} — not dispatched: ## Where overlaps uncommitted changes ({paths}); commit or stash them first` and move on, so the revert and the stage never touch a user's edit.
- **`HEAD_expected`** (`head:`) — every commit this run makes (4f.1) advances it; any other movement is an implementer committing.

The **run's own paths** are the instruction folder (`## Attempts` appends and X-item files land there) and `paths.reviews` (the review reports). They are never counted by a check.

The facts live in `.megamaid/fix/`, one state file per instruction folder; every later `fix` command reads them, and you pass it the rest on each call (codes, reported files, which items are in flight).

## Step 2: Surface relevant directives

Apply the focus-brief matcher in `${CLAUDE_PLUGIN_ROOT}/shared/directive-matching.md`. It records the matched directive paths and flags them as **primary** in the run brief under "Directives most relevant to this run"; an empty focus brief flags nothing, and all directives still load normally.

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" directives --brief "<focus brief>"
```

Record the `plugin:` and `user:` paths and the `primary:` lines; `megamaid.py brief` renders them into every run brief. Quote the brief for the shell here and in every `brief` call (single quotes, or escape `"`, `$`, and backticks).

## Step 2.5: Detect folder shape

Run:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" batches --folder <instruction folder>
```

Its `shape:` line is the folder shape below; its `write-set` lines are the items' write-sets (Step 4a); its `not-reproduced:` line is the list below; its `batch` lines are the ceiling Step 4a launches from — a batch may be split, never merged. The shapes:

- **Per-finding folder** — multiple files matching the per-finding naming pattern (`{C|H|M|L|T|D|X}{n}-*.md`, optionally also `G{n}-*.md` for groups). This is the historical default. Use Steps 3–4 below as today.
- **Single revise-doc folder** — the folder contains exactly one file matching `revise-*.md` (and no per-finding files). This means the upstream `/megamaid:plan` ran against a non-code review report. Use the single-revise flow described in Step 4 below.

Surface the detection to the user before proceeding:

```
Instruction folder shape: {per-finding | single revise-doc}
{N items to process | 1 consolidated revise-doc: revise-{spec-stem}.md}
```

**Not-reproduced items.** The `not-reproduced:` line names every item whose `**Finding status:**` header starts with `not reproduced`; list them separately and do not queue them:

```
{K} not reproduced by the planner (not queued): {codes with titles}
Say "queue {code}" to run one anyway.
```

A file without the header predates this field and queues normally. In `/megamaid:vacu-suck` these items are skipped and reported in the final summary; nothing asks.

**Cut the manifest excerpt** (only when `paths.patterns` resolved), per `${CLAUDE_PLUGIN_ROOT}/shared/manifest-slicing.md`, with the instruction folder as the touched text (the script reads every `.md` in it, so this covers per-finding files and the single revise doc alike):

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/manifest.py" excerpt --skill fix --manifest <paths.patterns> --touched-from <instruction folder>
```

Run it from the project root. An X-item discovered mid-run (Step 4) was not in the folder when the excerpt was cut; its implementer and reviewer still get the excerpt, and its banner lists the omitted sections by line range for them to read if needed.

Record `run`, `excerpt`, the log line, and `stale`. On the contract's fallback condition, print the fallback notice and deliver the full path alone.

## Step 3: Suggest groupings

**Skip this entire step on a single-revise-doc folder.** There's nothing to group — there's already exactly one work item.

For per-finding folders: scan instruction files for items that touch the same file with trivial scope. Suggest combining:

```
L1, L2, L3 all touch imports in ContactsGrid.tsx — combine?
M2 and M4 both fix the same hook — combine?
```

The user decides. Grouped items share one implementation pass but each sub-item gets verified.

## Step 4: Execution loop

**Branch on folder shape (Step 2.5):**

- **Per-finding folder:** today's execution loop (Steps 4a–4f below) runs once per instruction file.
- **Single revise-doc folder:** the loop runs **exactly once** against the single `revise-*.md`. The item is **always classified standard** (it is a multi-finding spec edit, not a single-line code fix), its write-set is the `**Target spec:**` path, and the reviewer role follows the single-revise-doc override in Step 4e (`consistency-auditor`, with 4e's fallback chain). If the reviewer FAILs three times, escalate to the user. The commit message on PASS is `revise {spec-stem}: apply review revisions`.

For both branches, Steps 4a–4f apply as written; the differences above are the only deviations.

For each item (or group):

### 4a. Parallel execution policy (governs Step 4b–4f)

An item's **write-set** is what `megamaid.py batches` (Step 2.5) prints for it: the file paths named in its instruction's `## Where`, line ranges dropped (a directory entry stands for everything under it); the `**File(s):**` paths when `## Where` names none; the `**Target spec:**` path for a revise doc. Two instructions overlap if their write-sets intersect — reads are free. Apply this policy to the execution loop below:

- Same-file writes → sequential.
- Different-file writes → parallel batch.
- **Concurrency limit:** max 3 items in flight at any moment.
- The script's `batch` lines already satisfy all three; split one when you must, never merge two.
- An item whose write-set is `(none)` is not dispatched: its implementer's every edit would be refused. Announce `{code} — not dispatched: the instruction names no file` and move on.

Three terms the git checks use:

- An item is **in flight** from its implementer dispatch until its commit lands (4f.1) or, after a stop, until the user resolves it. Implementer stage, reviewer stage, PASS awaiting verification, and stopped all count; a committed item does not. When the run makes no commits, an item leaves flight when `fix commit` reports `skipped (commits off)`; its reported paths become **finished paths**, recorded with their content. A later item on the same file is dispatched as usual and checked against the tree the earlier item left.
- The **allowed set** is `D0` ∪ the run's own paths ∪ the finished paths ∪ the write-sets of every in-flight item (Step 1.6 for the first two). It is what the working tree may contain at any moment.
- **Changed** means different from `HEAD`, or, for a finished path, from its recorded content; a revert restores the same.
- **Stop the item** means dispatch no further stage for it and leave its edits in place; its write-set stays in the allowed set until the user resolves it. **Stop the batch** means dispatch nothing further for any item in the batch, let the implementers already running return, print the per-item status list from 4f.1 for the batch, and hand the tree to the user. A HEAD stop (4d.1 check 1) stops the batch: `HEAD_expected` is stale for every batch-mate until the user resolves it. The orchestrator cannot interrupt a running agent; a stop is a promise about what it will not start.

**Verdicts and overrides.** The `fix` commands below report a verdict; they never decide the next step. Act on the verdict by default. When you have a reason to act otherwise (a verdict built on a wrong input, a hole in this skill), do so, and log one line: `override <step> <code>: <verdict> → <what was done> — <why>`. Any git step of your own or the user's that these commands did not make (keeping an implementer's commit, a hand commit, a stash) is an override too: log it, then run `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix resync --folder <instruction folder> --in-flight <in-flight codes>`, which re-reads `HEAD_expected` and `D0` and keeps the finished paths; without it every later check reads stale facts. Every override lands in the `Overrides:` list (Step 5). A group from Step 3 is passed as one code, `L1+L2+L3`.

Launch a parallel batch per the delivery contract (`${CLAUDE_PLUGIN_ROOT}/shared/dispatch-delivery.md`) — one Agent call per item, batched in a single assistant message.

Announce batches before launching:

```
Running batch: L1, L2, L3 in parallel (no file overlap, 3-pair concurrency)
```

### 4b. Read the instruction

Read the full fix instruction file. Understand What, Why, Where, How, Expected Outcome, Scope.

### 4c. Classify: trivial or standard?

Triviality is **judgment-based by the orchestrator** using this rubric:

**Trivial:**
- Single-line edits
- Import reorders
- Comment fixes
- Lexical renames within a single file

**Standard:**
- Anything multi-file
- Anything that changes behavior
- Anything that introduces a new control-flow branch

This is a judgment call — borderline cases lean **standard**, because the cost of a needless reviewer is small but the cost of a missed regression is high. The user can override the classification for any item.

For trivial items: announce "(trivial — implementer `{resolved models.fix.implementer_trivial}`, reviewer `{resolved models.fix.reviewer}`)" and proceed. The reviewer runs for every item.

### 4d. Send to implementer

**Agent config (resolved per item):**

- **Resolve the writer role** (the shipped `megamaid:implementer` by default; the five review agents are read-only and cannot serve; the user's `agents.implementer` override is honored):

  ```
  python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" resolve --role implementer --lane fix.implementer_standard      # fix.implementer_trivial for trivial items
  ```

  Pass `effort:` as the Agent call's `effort` unless `unset`; pass no `model` unless the user named one for this run (the hooks module sets `model:` at spawn).
- **Write the implementer run brief** once per run (every implementer shares it):

  ```
  python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" brief --skill fix --role implementer --run <run> --excerpt <excerpt> --manifest <paths.patterns> --brief "<focus brief>"
  ```

  Omit `--excerpt` and `--manifest` when no manifest resolved and `--brief` when the focus brief is empty. `<run>` is the stem the Step 2.5 excerpt printed. When no excerpt was cut this run, omit `--run` on the first `brief` call, record the `run:` it prints, and pass that stem as `--run` to every later `brief` call and to the final `clean`. Echo the four lines it prints; its `brief:` path goes into the prompt.
- **Delivery contract:** `${CLAUDE_PLUGIN_ROOT}/shared/dispatch-delivery.md`.
- **Fresh agent per item** — no accumulated state.
- **HEAD is tracked per run, not per item:** `HEAD_expected` (Step 1.6) is what 4d.1 compares against when the implementer returns; `fix commit` advances it for this run's own commits, so a batch-mate's commit is not mistaken for the implementer's.

**Implementer dispatch prompt (shared context + briefs):**

```
You're an implementer. Execute this fix instruction precisely and completely.

## 1. Shared context

Repository: {project-root}
Branch: {branch}
Item: {reference_code} — {title}
Class: {trivial|standard, from 4c}
Instruction file: {instruction-path}

Read these first, in order: ${CLAUDE_PLUGIN_ROOT}/shared/fix-implementer-brief.md, {run brief path printed by `megamaid.py brief` (skill fix, role implementer)}
```

### 4d.1. When the implementer returns

Three git checks, before any reviewer is dispatched:

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix check --folder <instruction folder> --code <code> --reported <files the implementer reported> --in-flight <the other in-flight codes>
```

1. **HEAD unchanged** — equals `HEAD_expected`. If not, the implementer committed: `stop-batch — HEAD moved during implementer ({HEAD_expected} → {new})`. Do not revert (a commit is not the orchestrator's to undo); surface `{code} — stopped: HEAD moved during implementer ({HEAD_expected} → {new}); resolve by hand before continuing`.
2. **Reported list equals the changed paths inside the write-set.** A changed path inside `## Where` that was not reported, or a reported path that is not changed → `stop-item`, naming which. A reported path outside `## Where` → `stop-item`, or `stop-batch` when it lies inside a batch-mate's write-set. The reported list is what the reviewer scopes, the revert restores, and the commit stages, so it must be exact; write-sets are disjoint within a batch, so attribution inside `## Where` is exact too.
3. **Tree inside the allowed set** (4a). A path outside → `stop-batch — {paths} changed outside every in-flight write-set ({codes})`. Do not guess which item did it.

`check {code}: ok` → dispatch the reviewer. Otherwise the first line is the strongest verdict and its reason, and each `reason` line after it is another failed check; stop the item or the batch (4a) and surface them.

Bound: these checks compare paths and one SHA. They do not read diffs; the reviewer does. A write inside a batch-mate's `## Where` by the wrong implementer is indistinguishable by path from the batch-mate's own work; the batch-mate's reviewer sees it as a stray hunk, and its `Batch-mates' write-sets:` line is what lets it report a possible spill from `{code}` instead of failing on sight.

### 4e. Send to reviewer (always)

**Agent config (resolved per item):**

- **Pick the role from the plan file's `**Specialty:**` header.** The header lists one or more source agents (e.g., `code-reviewer`, `code-reviewer + consistency-auditor`). The orchestrator picks one based on the finding's primary lens: spec/scope drift → `consistency-auditor`; correctness/contracts/security → `code-reviewer`; over-engineering / dead code → `simplifier`; error handling / silent failures → `silent-failure-hunter`; test coverage / regression → `test-auditor`. If multiple are equally appropriate, pick the first in the header.

  **Single-revise-doc override:** if the instruction file is a `revise-*.md` (per Step 2.5 detection), bypass plan-file specialty parsing entirely. The reviewer role is always `consistency-auditor` (it is reviewing whether spec revisions match the spec/lens framing of the upstream review). The fallback chain still applies if `agents.consistency-auditor` isn't configured.

- **Fallback chain when the header is missing or the picked role isn't in the user's `agents` config:** `agents.test-auditor` → `agents.code-reviewer`. If neither resolves, abort the run with a clear error.
- **Resolve the picked role:**

  ```
  python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" resolve --role <picked role> --lane fix.reviewer
  ```

  Pass `effort:` as the Agent call's `effort` unless `unset`; pass no `model` unless the user named one for this run (the hooks module sets `model:` at spawn).
- **Write the reviewer run brief**, one per distinct picked role per run:

  ```
  python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" brief --skill fix --role <picked role> --run <run> --excerpt <excerpt> --manifest <paths.patterns> --brief "<focus brief>"
  ```

  Omit `--excerpt` and `--manifest` when no manifest resolved and `--brief` when the focus brief is empty. `<run>` is the stem the Step 2.5 excerpt printed. When no excerpt was cut this run, omit `--run` on the first `brief` call, record the `run:` it prints, and pass that stem as `--run` to every later `brief` call and to the final `clean`. Echo the four lines it prints; its `brief:` path goes into the prompt.
- **Delivery contract:** `${CLAUDE_PLUGIN_ROOT}/shared/dispatch-delivery.md`.
- **Fresh agent.**

**Reviewer dispatch prompt (shared context + briefs + implementer's report):**

```
You're a code reviewer verifying a fix against its original instruction.

## 1. Shared context

Repository: {project-root}
Branch: {branch}
Item: {reference_code} — {title}
Instruction file: {instruction-path}
Batch-mates' write-sets: {for each other in-flight item: "{code}: {paths}"; or "none — this item runs alone"}

Read these first, in order: ${CLAUDE_PLUGIN_ROOT}/shared/fix-reviewer-brief.md, {run brief path printed by `megamaid.py brief` (skill fix, role = the picked reviewer role)}

### Implementer's report

{implementer's summary, including any `### Divergences` section}
```

### 4f. Handle the result

- **PASS** — proceed to **Step 4f.0** (verify), then **4f.1** (commit), then announce complete and move on. When the reviewer's `Unverified:` line names anything other than `nothing`, announce the item as `{code} — PASS (partial verification: {what the reviewer could not check})` and carry that note into the end-of-run summary. This is a log line, not a gate: it does not block the commit and asks the user nothing.
- **FAIL** — in this order:
  1. **Revert the attempt and record it.** Write the reviewer's FAIL text (verbatim or trimmed to its specifics) to a file under `.megamaid/`, then:
     ```
     python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix revert --folder <instruction folder> --code <code> --reported <reported files> --in-flight <the other in-flight codes> --reviewer-file <that file> --plan-change "<what you changed in ## How and why | none>"
     ```
     It restores each reported path (deleting one the item created), never touches a path inside another in-flight item's write-set (`skipped`), and appends to the instruction file, creating the section on the first FAIL:
     ```markdown
     ## Attempts

     ### Attempt {n} — FAIL
     **Reviewer:** {the FAIL text}
     **Plan change:** {what you changed in `## How` and why | none}
     ```
     `revert {code}: clean` → the write-set is as the attempt found it. `dirty — {paths}` → stop the item and surface them. A retry starts from the tree the first attempt started from — "fresh agent" is only true when the tree is fresh too.
  2. **The section is append-only.** If the instruction is wrong, change `## How` before the revert and say so in `--plan-change`; the next reviewer verifies against the changed How and can see it changed.
  3. **Retry.** Send a new implementer (Step 4d), then review again (4e). **After three FAILs on one item, stop and ask the user** — trivial or standard alike — printing the per-item status list from 4f.1 first, so the other in-flight items are not lost in the question. Three failures mean the instruction or the classification is wrong, and that is the user's call. A 4f.0 verification FAIL counts as one of the three.
- **DISCOVERED** — the reviewer found an issue outside this fix. The orchestrator does not write the instruction: it dispatches a planner for it, exactly as `/megamaid:plan` Step 6 does for one finding. Resolve the planner with `megamaid.py resolve --role planner --lane plan` (its `effort:` and model as in 4d), write a planner run brief with `megamaid.py brief --skill plan --role planner --run <run> …` (same excerpt and manifest flags as 4d), and send a plan-shaped prompt: `## 1. Shared context` with `Repository`, `Branch`, `Base: <paths.base_branch>`, `Report under planning: none — discovered during fix by {code}'s reviewer`, `Output folder: <the instruction folder>`, `Reference code: X{n}` (the next free one), `Severity: Medium` unless the block says otherwise, `Specialty source: <the reviewing role>`, `Output file: <folder>/X{n}-{title-slug}.md`, `Files referenced by the finding: <the DISCOVERED block's paths>`; then `Read these first, in order: ${CLAUDE_PLUGIN_ROOT}/shared/plan-brief.md, <that run brief>`; then `## Finding` holding the DISCOVERED block with `**Verified (from the review report):** none — discovered during fix`. The file it writes lands in the instruction folder, which is the run's own. The `X` prefix means "extra, found during execution" and is distinct from `D{n}` Deferred items. Add the resulting file to the end of the queue (its `Finding status` applies like any other) after `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix gate --folder <instruction folder> --code X{n}`: `gate X{n}: not-dispatched — {paths}` is Step 1.6's not-dispatched rule. Announce:
  ```
  M3 — PASS (5/15 complete)
  Discovered issue added: X1 — {title} (planned by {planner model}; queue is now 16 items)
  Next: M4 — {title}
  ```

### 4f.0. Verify before commit

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix verify --folder <instruction folder> --waiting <PASSed codes waiting to commit> --reviewing <codes still under review>
```

It runs the command Step 1.6 recorded and compares it with the baseline. `verify: none configured` → skip with that note on the item's progress line.

**When it runs.** Only when no implementer of the batch is in flight: reviewers are read-only, so the tree is quiescent then, and the suite does not see a batch-mate's half-written file. A PASSed item waits for that point before verifying and committing; a batch whose items all PASS is verified once, which is also the cheap choice when the command is slow.

**Reading the result.**

- `verify: green` → every waiting item proceeds to 4f.1.
- `verify: red before the run (unchanged)` → no failing line outside the Step 1.6 baseline; not caused by this run. Proceed as if green and carry `verification: red before the run (unchanged)` on the item's progress line.
- `verify: fail {codes} (exit {n}) — {first new line}`, then a `line` per further new line → each listed item takes the **FAIL**: a PASSed item takes the 4f FAIL path now; an item still under review takes it when its reviewer returns, whatever the reviewer said. The command lists an item when a new line names a path inside its write-set, and lists every waiting item (none under review) when a new line names no write-set (test-file paths, or none). The Attempt's reviewer text reads `verification: <command> exited <n>` followed by those lines.
- After the attributed item's revert (4f step 1) and before its retry is dispatched, run it again for the items still waiting; they commit on green. The retry then starts, and later items wait for quiescence as before.

No commit lands on red.

Bound: this runs the project's own command and reads its exit code and output. It does not decide what the right command is beyond review Step 5's rule, does not map test files to the sources they cover, and does not interpret output beyond comparing lines with the baseline and matching paths against write-sets. When a suite reports test-file paths rather than sources, the last rule can fail a whole batch for one item's breakage; sequential items avoid that at the cost of one run per item.

### 4f.1. Commit on PASS

```
python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" fix commit --folder <instruction folder> --code <code> --title "<title>" --reported <files reported by implementer> --in-flight <the other in-flight codes>
```

The orchestrator runs the commit, not the implementer subagent. The command:

- **Stages and commits only the reported list** as `<code>: <title>` (`revise {spec-stem}: apply review revisions` for the revise doc). Step 4d.1 check 2 confirmed the list equals the item's changed footprint inside `## Where`, so it is complete for this item. It prints `commit {code}: {sha}` and advances `HEAD_expected`.
- **Checks the tree after the commit:** the tree minus the allowed set (4a; this item is no longer in flight) must be empty. `commit {code}: tree not clean — {paths}` → stop the run and surface `tree not clean after {code}'s commit: {paths}` (a hook that rewrites files, or an edit nobody reported).
- **Reports a failed commit** as `commit {code}: failed — {git's message}` (pre-commit hook reject, signing failure, conflict, anything non-zero): abort the run and surface the error, then print the per-item status list so nothing is lost (the same list a batch stop prints, 4a):
  ```
  {code} — committed
  {code} — PASS, uncommitted ({files})
  {code} — in progress ({implementer | reviewer})
  {code} — stopped ({why})
  Overrides: {one per line} | none
  ```
  Do not retry blindly. The user investigates.
- `commit {code}: skipped (no changes)` → the item produced no change; nothing to commit.
- `commit {code}: skipped (commits off)` → commits are off for this run (Step 1.6); the reported paths are recorded as finished (4a) and changes accumulate in the working tree.

## Step 5: Progress tracking

After each item:

```
{code} — PASS ({N}/{total} complete)
Next: {next_code} — {title}
```

With extras:
```
{code} — PASS after 1 retry ({N}/{total} complete)
{code} — PASS after 1 retry (plan adjusted) ({N}/{total} complete)
{code} — PASS, trivial implementer ({N}/{total} complete)
{code} — PASS, verification: none configured ({N}/{total} complete)
{code} — PASS (partial verification: {what the reviewer could not check}) ({N}/{total} complete)
```

`(plan adjusted)` appears when any `## Attempts` entry's **Plan change** is not `none`; the plan the commit satisfies is not the plan the planner wrote, and the summary says so.

At the end:

```
All {N} items complete:
  - C1: PASS
  - H1: PASS
  - H2: PASS (1 retry)
  - M4: PASS (partial verification: Expected Outcome needs a browser check)
  - L1-L3: PASS (parallel batch, trivial implementer)
  - X1: PASS (discovered during H2 review)
  - ...

{M} items deferred:
  - (deferred items listed by their review code, e.g., D1-D4)

{K} discovered during execution:
  - X1: {title} (found reviewing H2) — PASS

{J} not reproduced by the planner (not run):
  - M7: {title} — {planner's looked-for text, one line}

Overrides: {one `override …` line each, as logged (4a) | none}
```

**Manifest notes (non-blocking).** Append the excerpt log line verbatim, then any staleness note (`stale: yes` → `PATTERNS manifest may be stale — consider re-running /megamaid:patterns.`; `unknown` → `PATTERNS staleness unknown (<detail>).`) or semantic-refresh note recorded during this run. Then, last of all: `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/manifest.py" clean --run <run>`.

## Ground rules

- **Fresh agents, fresh tree.** Each implementer and reviewer is a new subagent, and a retry starts after the failed attempt is reverted (4f). No accumulated state in either.
- **Git is the orchestrator's, through the `fix` commands.** Implementers never commit; the HEAD check (4d.1) stops an item whose implementer did. A git step outside the commands is an override (4a).
- **The orchestrator never edits a file in a write-set**, except to revert an attempt (4f). A change, however small, goes through an implementer: a reviewer that wants one returns FAIL.
- **The instruction is the spec.** Implementer follows it. Reviewer verifies against it. If the doc is wrong, fix the doc first, then re-implement.
- **Scope is sacred.** Implementers don't make changes outside scope. Reviewers flag scope violations as FAIL.
- **Don't loop forever.** Three failures on one item means the instruction or its classification is wrong. Stop and ask — there is no orchestrator-applied fix.
- **Parallelize when safe.** Different writes = safe. Same file = sequential.
