# /megamaid:review

`/megamaid:review [scope] [focus brief]` reviews a change with 1 to 5 agents and writes one report.

## Scope

| You give | How it is read |
|---|---|
| a PR number | `gh pr diff <n> --name-only` for the files, `gh pr view` for title and body |
| a branch name | `git diff --name-only origin/<base>...<branch>`; base is `paths.base_branch` (default `main`), overridable per call without touching config |
| a list of files | that list; a spec or design doc goes in this way |
| nothing | derived from the current branch; one question if ambiguous |

Agents and the report diff against the recorded merge-base SHA, not a branch name.

## Focus brief

Everything after the scope. It is authoritative: it steers the palette, the lens, and which directives are flagged primary. A brief word that names a directive file (`scope` flags `scope-discipline.md`) makes it primary; the rule is in [../api/scripts.md](../api/scripts.md). Primaries are listed first in every agent's run brief; every directive still loads. A brief that contradicts the shipped flow ("skip the report", "use only one agent") gets one question.

## Read of the work

Before picking agents the orchestrator prints a characterization of the artifact, the lens the agents should apply, and a classification: **code-shaped** (executable code, config that changes runtime behaviour, tests; a mixed diff is code-shaped) or **non-code** (spec, design doc, prose). The brief can override it ("treat as code review").

## Palette

- 1 to 5 roles from `config.agents`, picked by judgment from the diff, each role's `when_to_use`, and the brief; the picks and reasons are printed and you can override. Never more than 5, never fewer than 1.
- `implementer`, `planner`, `pattern-scanner`, and `pattern-shaver` are never eligible, whatever the brief says.
- Code-shaped: `code-reviewer` is the anchor. Non-code: `consistency-auditor` is the anchor, `code-reviewer` is left out, and `silent-failure-hunter` and `test-auditor` usually are too.

## What each reviewer gets

One Agent call per role, all launched together, with the model and effort of the `review` lane (`agents.<role>.model` and `.effort` beat it). The prompt carries the shared context (repository, branch, base, merge-base, files, commits, PR description, reference implementation), the read of the work with a bias guard, and one path: `Read first: .megamaid/excerpts/<run>.review.<role>.brief.md`. That run brief lists the directive paths with the primaries flagged, the PATTERNS excerpt path and the full manifest path when a manifest resolves ([patterns.md](patterns.md)), and the focus brief. Nothing is pasted into the prompt. A reviewer from outside the plugin also gets the output spec and, in its brief, an instruction that the directives are authoritative plus its `when_to_use` as its lens.

For a code-shaped change the orchestrator also runs the project's own checks (typecheck, tests, lint, as named in `CLAUDE.md` or the build manifest) while the agents work; the results go in the report's verification table.

## Verification pass

Agent output is a proposal; the report is authoritative. Before a finding enters it the orchestrator:

1. opens every cited file at every cited line, from a numbered read; a finding whose anchor does not resolve is re-anchored or dropped;
2. recomputes every count, ratio, and all/none/only claim;
3. traces every suggested fix, or marks it unverified;
4. treats its own merged text the same way;
5. resolves every directive citation to a loaded file and a numbered heading.

Duplicates across agents are merged: the most detailed text kept, every agent credited, the highest severity taken (code-shaped; a non-code review keeps the first label). A `Sources:` line counts each agent's findings reported, kept, merged, and dropped (anchor, count, duplicate, calibration), or `no report (timed out)` after ten minutes. The pass is not a second review: severity is inherited from the agent that rated it.

Every finding carries `Verified: <what was confirmed>; <what was not>`, naming the check (`Read foo.ts:118-126; recomputed the count (4 of 5)`), never the act (`verified against source`). When nothing was confirmed the line says `not independently verified — <what is unchecked>`.

## Report

| | Code-shaped | Non-code |
|---|---|---|
| Header | title, branch → base, scope, reviewers, sources, date | title, artifact, scope, reviewers, sources, date |
| Body | verification table; `Verdict: APPROVE` or `NEEDS WORK` (APPROVE when nothing Critical or High); findings under Critical / High / Medium / Low / Test gaps / Deferred, coded C1, H1, M1, L1, T1, D1 | the read and the lens; a flat findings list with the agents' labels (Ambiguity, Blind spot, Pattern-break, Reusability gap, Quality concern), no verdict, no table, no tiers |
| Per finding | code and title, source agents, `file:line`, `Verified:`, what is wrong, why it matters, fix, directive citations as `<file>.md §N.N` | label and title, source, location, `Verified:`, what is wrong, suggested resolution |

Deferred items get codes too, so `/megamaid:plan` can plan them.

## Where it lands

`<paths.reviews>/pr-<N>-round<R>-report.md` or `branch-<slug>-round<R>-report.md` (default `docs/megamaid/reviews/`). `R` is one more than the highest round already named for that prefix, so a deleted report never collides with a surviving later one. Beside it the hooks module writes `…-round<R>-usage.md`, the run's token ledger ([usage-ledger.md](usage-ledger.md)). The run's brief and excerpt files under `.megamaid/excerpts/` are removed at the end; the report and its ledger are the only new files.

The summary names the path, the verdict and severity counts (or the label counts), the agents used, the `PATTERNS excerpt:` line, a staleness note when the manifest's base commit is behind the files it cites (or `PATTERNS staleness unknown (…)`), and `This diff evolves a convention not in the manifest…` when an agent flagged a deliberate new pattern.

## Running again

Each run is a new round with its own report and ledger. Earlier reports are not read, so a finding already fixed in a prior round can be flagged again. Models, effort, reviewers, and directives: [README](../../README.md#configuration).
