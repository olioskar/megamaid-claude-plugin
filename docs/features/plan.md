# /megamaid:plan

`/megamaid:plan [report-path] [focus brief]` turns a review report into fix instructions. Without a path it takes the report in context, else the newest under `paths.reviews`.

## Report shape

| Report | What plan does |
|---|---|
| Code-shaped (`## Verdict`, findings by severity) | one planner per finding, all in parallel; the finding count is confirmed with you first |
| Non-code (`## Read`, `## Lens`, flat labelled findings) | one planner writes a single `revise-<spec-stem>.md`; no count question |

`megamaid.py findings` lists every coded finding with its `Verified:` line. Deferred items are planned like the rest; you are the gate, not the planner. Grouping is offered once for findings that share a file, sit on adjacent lines, or depend on each other; an accepted group gets a `G<n>` code and one file that lists every sub-item.

## The planner

Role `planner` (`megamaid:planner` by default; `agents.planner` overrides it, see [README](../../README.md#use-your-own-writer-or-planner)), model and effort from the `plan` lane. Each dispatch gets:

- shared context: repository, branch, base, report path, output folder, the finding's code and severity, its source agents, its output file, the files it names, and 2 to 3 adjacent files the orchestrator picks;
- `Read these first, in order:` `shared/plan-brief.md` (the job and the file format) and the run brief (directive paths with primaries, the PATTERNS excerpt when a manifest resolves, the focus brief);
- the finding in full, with its `Verified:` line verbatim.

A specialty lens (the reviewer role the finding belongs to, `code-reviewer` by default) frames the prompt and lands in the file's `Specialty:` header, which `/megamaid:fix` uses to pick the fix reviewer; it is not the agent that runs.

Tools: reading, searching, Bash (`git log`, `git blame`, `grep`), and Write for its one file; `Edit` and `Agent` are withheld. It never edits source, never commits, never dispatches. For a revise-doc the prompt carries the job and format itself and names the run brief only.

A planner's Edit or Write to any path but its output file is refused while the hooks module is loaded.

## Re-check

The planner reproduces the finding before writing: it opens the code, confirms the defect, and re-derives anything the `Verified:` line names as unchecked (an anchor, a count, a fix shape); a finding without the line is treated as unconfirmed throughout. A finding it cannot reproduce gets `Finding status: not reproduced — <what it looked for>`, a one-line `## How` that proposes no change, and `Check: none`; `/megamaid:fix` lists such items and queues one only when asked.

## Instruction file

`<paths.plans>/plan-for-<report-stem>/<CODE>-<title-slug>.md` (default `docs/megamaid/plans/`), for example `docs/megamaid/plans/plan-for-pr-123-round1-report/C1-stale-closure-in-hook.md`.

| Part | Holds |
|---|---|
| H1 | `<code> — <title>` |
| Header | `Severity`, `File(s)`, `Specialty`, `Finding status`, `Depends on` (codes whose fix this plan's How assumes is in, or `none`); `Consolidates` for a group |
| `## What`, `## Why` | the change and its cost |
| `## Where` | exact paths and lines; the item's write-set for batching and the only place the implementer may write |
| `## How` | before/after code blocks, precise enough to apply mechanically |
| `## Expected Outcome` | what differs after, then `Check: <command or observable the fix reviewer runs>` or `Check: none — <why>` |
| `## Scope` | in and out |
| `## Directive citations` | `<file>.md §N.N` per source, or `None` |
| `## Considered alternatives` | optional; rejected options with a one-line reason |

A revise-doc holds one section per finding in report order (spec location, current text, revision, reason) and notes for the implementer.

## Count check

After the planners return, the orchestrator lists the folder and compares leading codes with the finding list. A code without a file re-dispatches its planner once, then is reported as `Missing:`; a file without a code is `Unexpected:`. This is a listing comparison; nothing reads the files. It is the only check on the planner's one-file boundary, and it runs for code-shaped reports only.

## Seniority

The planner is the senior of the planner/implementer pair; where to save is in the [README](../../README.md#models-and-effort).

## Summary

The files grouped by severity, `Next: /megamaid:fix <folder>`, the `PATTERNS excerpt:` line and any staleness note. Working files under `.megamaid/excerpts/` are removed; the ledger is at `.megamaid/usage/plan-<start>.md` ([usage-ledger.md](usage-ledger.md)).
