---
name: help
description: Use when the user types `/megamaid:help`, asks "what is megamaid", "what does megamaid do", "megamaid commands", "how do I use megamaid", or wants a refresher on the plugin. Pass a command name (e.g., `/megamaid:help fix`) for a deeper look at one command.
argument-hint: "[command-name]"
allowed-tools:
  - Read
user-invocable: true
disable-model-invocation: false
---

You print help for the megamaid plugin.

## Behavior

- If `$ARGUMENTS` is empty: print the **Overview** below verbatim.
- If `$ARGUMENTS` names a command (`review`, `plan`, `fix`, `vacu-suck`, `patterns`, `configure`, `help`): print the matching **Per-command** entry verbatim.
- If `$ARGUMENTS` is anything else: print the Overview and add a one-line note: `Note: "{argument}" isn't a megamaid command. Try one of: review, plan, fix, vacu-suck, patterns, configure.`

Don't paraphrase. The user is asking for the help text — give them the help text.

---

## Overview

```
megamaid — code-review pipeline for Claude Code

A review → plan → fix workflow with configurable reviewer agents and
authoritative project directives.

Commands

  /megamaid:review     Dispatch 1–5 reviewer agents over a PR, branch, file
                       list, or a spec/design doc. The orchestrator reads the
                       work first and right-sizes the apparatus: code-shaped
                       diffs get the full report (verdict, severity scale,
                       verification); non-code artifacts get a condensed
                       report (flat findings, no verdict). Read-only.

  /megamaid:plan       Turn each review finding into a self-contained fix
                       instruction file. Read-only.

  /megamaid:fix        Execute fix instructions: implementer + reviewer
                       per item, parallel batching where safe.

  /megamaid:vacu-suck  Run review → plan → fix as one continuous sweep.
                       One model (models.vacu_suck) everywhere. No pauses,
                       nothing skipped but not-reproduced items. On non-code
                       artifacts, stops after
                       review — findings go back into your design
                       conversation, not an autonomous rewrite pass.

  /megamaid:patterns   Scan the codebase and write a PATTERNS manifest of
                       concrete conventions (structure, naming, closed token
                       sets, abstraction level, reuse points) with real code
                       references. Interactive: confirms scan areas first.
                       review/plan/fix consume it as an observed baseline,
                       delivered to agents as a per-run excerpt. --shave
                       trims an existing manifest without changing it.

  /megamaid:configure  Edit megamaid.config.json conversationally — paths,
                       models, enable/disable agents. Migrates a config
                       or PATTERNS manifest named in a notice: line.

  /megamaid:help       This message. Pass a command name for details.

Requirements

  megamaid needs a Claude Code build with hooks modules, and its hooks
  module loaded. If a command replies MEGAMAID-MODULE-NOT-LOADED, the
  module did not load:

    Claude Code without hooks modules   update Claude Code (an old build
                                        may refuse the plugin outright)
    disableAllHooks in settings         remove it or set it to false
    "hooks modules are turned off …     start claude once with network
     rollout switch"                    access; if it stays, hooks
                                        modules are off for your account
    fix-auto or vacu-suck run inside a  run it from the main conversation
     subagent                           (the module is loaded, but a
                                        subagent's Read of a sub-skill
                                        gets no note, so it stops)
    anything else                       run claude --debug-file <file>
                                        and read the line naming megamaid

  Each run writes a usage ledger (tokens per lane and role, the
  orchestrator's share, the session cost over the run): beside the review
  report once it is written, named like it with -usage.md for -report.md
  (pr-12-round1-usage.md), for review and vacu-suck; under
  .megamaid/usage/ for the other commands. It counts the main loop's turns
  until the next run or the session ends.

Focus brief

  Every command accepts free text after the slash. The brief biases
  agent picking and finding priority:

    /megamaid:review look for spec/plan misalignment
    /megamaid:vacu-suck ensure simplicity, scope discipline, TDD coverage

Common workflows

  Iterative:    /megamaid:review → review the report → /megamaid:plan →
                approve groupings → /megamaid:fix
  Full sweep:   /megamaid:vacu-suck  (review + plan + fix in one pass)

Config

  Layered, deep-merged in this order (later wins):
    1. plugin defaults  (${CLAUDE_PLUGIN_ROOT}/config/defaults.json)
    2. global override  (~/.claude/megamaid.config.json)
    3. project override (<project-root>/.claude/megamaid.config.json)

  Edit interactively: /megamaid:configure
  Or hand-edit the JSON files above.

For more on a command:  /megamaid:help <command-name>
```

---

## Per-command

### review

```
/megamaid:review [scope] [focus brief]

Step 1 of the review → plan → fix workflow.

Inputs
  scope         A PR number, branch name, or explicit file list.
                Defaults to the current branch diffed against
                paths.base_branch (default: main).
  focus brief   Optional free text — biases agent picking and finding
                priority.

What it does
  - Picks 1–5 reviewer agents based on the diff and the focus brief.
  - Dispatches them in parallel against the project's directives.
  - Runs typecheck/tests in parallel.
  - Verifies each finding's anchors and counts, then consolidates
    them into a severity-ranked report. Every finding carries a
    Verified: line naming what was checked and what was not.

Config knobs
  models.review           (default: opus)   reviewer model
  effort.review           (default: unset)  reviewer effort (session default)

Output
  <paths.reviews>/{pr-N|branch-NAME}-roundN-report.md

Examples
  /megamaid:review
  /megamaid:review 774
  /megamaid:review staging look for spec/plan misalignment
```

### plan

```
/megamaid:plan [report-path] [focus brief]

Step 2 of the review → plan → fix workflow.

Inputs
  report-path   Path to a review report. Defaults to the most recent
                report in <paths.reviews>.
  focus brief   Optional free text — passed through from /megamaid:vacu-suck.

What it does
  - Parses every finding (including Deferred).
  - Suggests groupings for related findings; you decide.
  - Dispatches one planner agent per finding (or group) in parallel.
  - Each agent reads the actual code and writes a self-contained fix
    instruction file.

Config knobs
  models.plan             (default: opus)   planner model; keep it strong: a good
                                            instruction lets a cheaper implementer apply it
  effort.plan             (default: unset)  planner effort (session default)
  agents.planner          (default: megamaid:planner)  the planner agent

Output
  <paths.plans>/plan-for-<report-stem>/<code>-<title-slug>.md
  one file per finding (or group)
```

### fix

```
/megamaid:fix [plan-folder] [focus brief]

Step 3 of the review → plan → fix workflow.

Inputs
  plan-folder   Path to a plan folder produced by /megamaid:plan.
                Defaults to the most recent plan folder.
  focus brief   Optional free text.

What it does
  - Pre-flight: checks the working tree. If dirty, asks once whether
    to commit existing changes, stash and restore, proceed without
    per-item commits, or abort.
  - Executes each fix instruction with implementer + reviewer per item.
  - Implementer is agents.implementer (default megamaid:implementer).
  - A discovered issue is planned by agents.planner on models.plan.
  - Reviewer specialty is matched to the plan's **Specialty:** header.
  - Reviewer evaluates plan-compliance: did the implementer execute the
    plan, and are reported divergences justified?
  - Parallel batching where safe; sequential where instructions overlap
    in scope; an item runs after the items its plan says it depends on.
  - Per-item commit on PASS, with the finding code + title in the
    message. Opt out via fix.commit_per_item: false.
  - Before each commit, runs the project's typecheck/tests/lint (the
    same choice /megamaid:review makes); red means FAIL, nothing commits.
  - On FAIL, reverts the attempt, records it under ## Attempts in the
    instruction file, and retries; stops after three.
  - Records a baseline after pre-flight (dirty paths, HEAD, test
    result) and checks git against it after every implementer and
    commit: HEAD moved only by its own commits, reported files equal
    the edits inside ## Where, nothing outside the in-flight items'
    ## Where, the plan folder, the review reports and (with commits
    off) the files earlier items finished, tree clean afterwards. It
    never reverts or commits a file you had uncommitted.
  - Items the planner marked "not reproduced" are listed, not run.

Models
  Trivial fixes:    models.fix.implementer_trivial   (default: sonnet)
  Standard fixes:   models.fix.implementer_standard  (default: opus)
  Reviewer:         models.fix.reviewer              (default: opus)
  Effort:           effort.fix.*                     (default: unset — session effort)

Config knobs
  fix.commit_per_item    (default: true)  per-item commit on PASS
  fix.model_invocation   (default: false) let Claude start fix from a
                         natural-language request ("apply the fixes")
                         (model-only fix-auto skill; /megamaid:fix stays user-only)
  agents.implementer     (default: megamaid:implementer)  the fix writer agent
```

### vacu-suck

```
/megamaid:vacu-suck [scope] [focus brief]

Run review → plan → fix as one continuous sweep, one model
(models.vacu_suck) everywhere, no pauses.

Inputs
  scope         Same as /megamaid:review.
  focus brief   Optional free text.

When to use
  - High-stakes branches where you want everything done in one pass.
  - When you trust the focus brief to do the steering.

When not to use
  - When you want a checkpoint between review and plan.
  - When you want to hand-pick which findings get instructions.

Config knobs
  models.vacu_suck       (default: opus)   replaces every lane model in the sweep
  effort.vacu_suck       (default: unset)  replaces every lane effort in the sweep
```

### patterns

```
/megamaid:patterns [--shave] [focus brief]

Generate or refresh the PATTERNS manifest — megamaid's record of this
codebase's concrete conventions, with real file:line references.
With --shave: trim an existing manifest without changing what it
asserts.

What it does
  - Recon: detects the codebase's regions (frontend, API, data, etc.)
    and flags non-authoritative ones (generated, vendored, reference-
    only per CLAUDE.md) to exclude so dead code isn't recorded.
  - One scan-plan gate: proposes areas, the directives mapped to each,
    and the exclusions — you adjust or reply "go". Flag a stale
    directive here to down-weight it.
  - Dispatches one read-only scanner per area in parallel, each with
    only its relevant directives.
  - Synthesizes an area-major manifest with thematic sections
    (structural, naming & vocabulary, closed sets, abstraction
    calibration, reuse points, error/async, testing).
  - If a scanner finds a widespread practice that conflicts with a
    directive, walks you through it — record as the new norm, treat
    as drift, or skip — and writes your choice into the manifest.
  - Pre-write review flags thin/empty areas and lets you re-scan one;
    on regenerate, shows a diff to cherry-pick per section.

Shave (--shave)
  - Never rescans. One shaver per large section proposes removals in
    three classes: a secondary anchor that pins the same claim as the
    canonical one; a bullet that restates a convention owned by
    another section (replaced by a pointer); a drift line whose every
    item is fixed. Nothing else — no prose rewriting, no renumbering,
    no edits to the header, drift register, or cross-reference map.
  - scripts/manifest.py verifies every edit mechanically (exact match,
    no heading removed, no citation vanishes, owner really cites it)
    and shows one gate: accept, or skip by class or section. Apply is
    all-or-nothing and stamps the header with "Shaved: <date>".
  - Every write prints the manifest's size; above 100 KB it suggests
    --shave.

Output
  <paths.patterns>   (default: docs/megamaid/PATTERNS.md)

Consumed by
  /megamaid:review, /megamaid:plan, /megamaid:fix — injected as an "observed
  baseline" (a prior, not law). Project directives outrank it.
  Silence falls back to reading code; deliberate improvements and
  new canonical patterns are not flagged as drift.
  Agents receive a per-run excerpt, not the whole file: the header,
  the global sections (how-to-read, cross-reference map, drift
  register), and the area sections whose scope meets the change.
  Omitted sections are listed with line ranges so an agent can read
  one with sed -n. Excerpts live under .megamaid/ (self-ignored by git)
  and are removed at the end of the run. The excerpt falls back to
  the full manifest with a printed notice when the script fails.
  python3 is required for every megamaid command: each skill
  starts with scripts/megamaid.py config and stops if it fails.

Config knobs
  paths.patterns          (default: docs/megamaid/PATTERNS.md)  null disables consumption
  models.patterns         (default: opus)                       scanner and shaver model
  effort.patterns         (default: unset)                      scanner and shaver effort
  agents.pattern-shaver   (default: megamaid:pattern-shaver)    shaver role
```

### configure

```
/megamaid:configure [scope] [change]

Edit megamaid.config.json conversationally.

Inputs
  scope    "project" or "global". project edits
           <project-root>/.claude/megamaid.config.json; global edits
           ~/.claude/megamaid.config.json. The shipped defaults at
           ${CLAUDE_PLUGIN_ROOT}/config/defaults.json are not editable.
  change   What you want different. Examples:
             "disable test-auditor"
             "use sonnet for the fix implementer"
             "change reviews dir to docs/reviews"
             "look for my directives in docs/our-rules"

What it does
  - Shows the merged effective config (so you see what's coming from
    where).
  - Translates the change into a JSON patch.
  - Shows a diff.
  - Writes after you confirm.
  - Verifies the result parses and the schema is sane.
  - When a notice: line names a config or PATTERNS manifest from an
    earlier install, offers to migrate it first (the config is
    translated to megamaid's keys; the manifest is moved or copied).
```

### help

```
/megamaid:help [command-name]

This command. With no argument, prints the overview. With a command
name, prints the deep-dive for that command.
```
