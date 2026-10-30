# /megamaid:fix and /megamaid:vacu-suck

## Starting a fix run

`/megamaid:fix [instruction-folder] [focus brief]` applies the files `/megamaid:plan` wrote. Without a folder it takes the newest under `paths.plans`. It is user-only: Claude cannot start it from a request. With `fix.model_invocation: true` ([README](../../README.md#let-claude-start-fixes)) a request in your own words ("apply the fixes") goes through the model-only `fix-auto` skill, which checks the flag and then runs the fix workflow unchanged, every question and commit included. Without the flag the request gets a reply naming `/megamaid:fix` and the flag.

## Pre-flight

The run's mechanical steps are `megamaid.py fix` commands ([scripts.md](../api/scripts.md)); each reports a verdict and the orchestrator acts on it (none ever reverts or stages a path among your uncommitted changes), or acts otherwise with a reason it logs as an override. With `commit_per_item` on, `fix preflight` lists uncommitted changes other than the run's own (the instruction folder, and the review reports under `paths.reviews`); any left ask once: commit now, stash and restore at the end, proceed without per-item commits for this run, or abort. After the answer, `fix start` records the baseline whether or not that question ran: the project's verification command (named in `CLAUDE.md`, else the build manifest; `none configured` otherwise) run once, the dirty paths (never touched by the run; an item whose `## Where` overlaps them is not dispatched), and `HEAD`, in `.megamaid/fix/`. A verification that is already red asks once: proceed or abort.

`megamaid.py batches` reads the folder: per-finding files (`C1-…`, `G1-…`, `X1-…`) or a single `revise-*.md` from a non-code report. Items whose `Finding status` is `not reproduced` are listed and not queued (`queue M7` runs one). Order: Critical → High → Medium → Low → Test gaps, an item after the ones its plan names on `Depends on`, confirmed with you; grouping of trivial same-file items is offered once.

## Batches

An item's write-set is the paths in its `## Where` (else `File(s)`; a revise-doc's `Target spec`). Items with disjoint write-sets run in parallel, at most three in flight; overlapping ones run in sequence, and an item runs in a batch after every item it depends on. Each batch is announced before launch. An item whose write-set is empty is not dispatched (`<code> — not dispatched: the instruction names no file`).

## What the hooks refuse

While the hooks module is loaded, an implementer's Edit or Write outside its item's write-set is refused, and the implementer stops and reports a divergence; a reviewer's `git diff HEAD~1` (any `HEAD~` or `HEAD^`) is refused with the `git diff HEAD -- <files>` form to use instead; a dispatch whose run brief is for another agent (a planner sent with the implementer's brief) is refused before it starts. Each agent's model comes from config at spawn unless you named one for the run.

## One item

| Step | Who | What |
|---|---|---|
| Classify | orchestrator | trivial (single-line edit, import reorder, comment, rename within one file) or standard (multi-file, behaviour change, new branch); borderline is standard; you can override |
| Implement | role `implementer`, lane `fix.implementer_standard` or `fix.implementer_trivial` | reads `shared/fix-implementer-brief.md` and the run brief, applies `## How` inside `## Where`, runs the `Check:` line if it can, reports every file changed and any divergence with its reason |
| Git checks | orchestrator, `fix check` | `HEAD` unmoved (an implementer that committed stops the batch); reported files equal the changed paths inside `## Where`; nothing changed outside every in-flight write-set |
| Review | the role in the file's `Specialty:` header, lane `fix.reviewer`; `consistency-auditor` for a revise-doc; fallback `test-auditor`, then `code-reviewer` | reads `shared/fix-reviewer-brief.md`, the instruction, the implementer's report, and `git diff HEAD -- <reported files>`; runs the `Check:` line from the project root; returns `PASS` or `FAIL` plus `Unverified: <what it could not check, or nothing>`; any change it wants is a `FAIL`, never a `PASS` with a note, and the orchestrator never makes one itself |
| Verify | orchestrator, `fix verify` | once no implementer of the batch is running, the baseline verification command; failures already in the baseline are ignored; a new failing path inside an item's write-set fails that item; one naming no write-set fails every item waiting |
| Commit | orchestrator, `fix commit` | the reported files only, as `<code>: <title>`; a revise-doc commits as `revise <spec-stem>: apply review revisions`; then nothing may be left outside the allowed set |

Agents are fresh per item and per attempt. The reviewer runs for every item, trivial included. A `Check:` that exits non-zero is a FAIL whatever the diff looks like; a step the reviewer could not check goes on its `Unverified:` line and the item passes as `PASS (partial verification: …)`.

## FAIL

1. Revert and record (`fix revert`): the reported files go back as the attempt found them (new ones deleted), `## Where` is confirmed clean, other in-flight items are untouched, and `## Attempts` is appended to the instruction file with the reviewer's text and any change made to `## How`.
2. Retry with a new implementer, then a new reviewer, from the tree the first attempt started from. After three FAILs on one item the run stops and asks, printing every item's status first. A verification FAIL counts as one of the three.

## DISCOVERED

A reviewer that spots a real problem outside its item reports it under `DISCOVERED`. The orchestrator dispatches a planner for it, as `/megamaid:plan` does for one finding ([plan.md](plan.md)), with the instruction folder as output, code `X<n>` (extra, found during execution), severity Medium unless the block says otherwise. The file joins the end of the queue (after `fix gate` applies the not-dispatched rule) and the progress line names it.

## Without per-item commits

`fix.commit_per_item: false` skips the pre-flight question and every commit; changes accumulate in the tree and the reviewer scopes its reading by the reported files. `fix commit` records a finished item's files with their content instead, so a later item on the same file still runs: its checks count only what it changed, and its revert keeps the earlier item's edit. With commits on, a commit that fails (hook, signing, conflict) aborts the run with every item's status printed.

## Summary

`<code> — PASS (<n>/<total> complete)` after each item, with `after 1 retry`, `(plan adjusted)`, `trivial implementer`, `verification: none configured`, or `(partial verification: …)` as they apply; at the end every item, the deferred, the discovered, the not-reproduced, and `Overrides:`, one line per verdict the orchestrator acted against and per git step it or you made outside the commands, or `none`. A halt (a batch stop, three FAILs, a failed commit) prints the per-item status list with the same `Overrides:` line. The `PATTERNS excerpt:` line and any staleness note follow; the ledger is at `.megamaid/usage/fix-<start>.md` ([usage-ledger.md](usage-ledger.md)).

## /megamaid:vacu-suck

`/megamaid:vacu-suck [scope] [focus brief]` takes review's scope and runs review, plan, and fix as one sweep. User-only. Differences from the three commands run by hand:

- `models.vacu_suck` and `effort.vacu_suck` replace every review, plan, and fix lane; per-role overrides survive; `models.patterns` is untouched.
- Execution order is `batches`' order: Critical → High → Medium → Low → Test gaps → Deferred → Discovered, an item after the ones it depends on.
- No confirmations: groupings, trivial or standard, deferred items (planned and fixed like the rest), and a contradicting focus brief are decided and logged. The only questions: an ambiguous scope at the start, fix's dirty-tree pre-flight, and "run again?" at the end.
- A red verification baseline is logged, not asked. Three FAILs on one item or a batch stop end the sweep with the status list.
- A non-code artifact stops the sweep after review; the report is the deliverable and nothing asks to run again.
- The focus brief reaches every dispatch in every step.

The end summary gives review's verdict and counts, plan's file count, fix's items, the not-reproduced list, and `Overrides:`, then asks "Want to run the sequence again?" with a recommendation: yes after Critical or High findings, judgment on Medium and below, stop on a clean round. A yes restarts from review with the same scope inside the same run, so the ledger beside the first report keeps counting.
