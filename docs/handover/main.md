# Main

Read at session start. Owns: the whole repository (the one role). Works with the maintainer (olioskar); spawns reviewer and implementer subagents and reads their reports, not their files. The steps and rules are in [dev-flow.md](../process/dev-flow.md); this file holds only what it does not say.

## What this role does

| Area | Rule |
|---|---|
| Subagents | Writers edit; this session commits. Reviewers get the files, never conclusions; one lens per reviewer (contract; code and tests) |
| Reviewing the plugin | Never with the plugin's own commands |
| Reports from subagents | Read the report, not the files it names; a side agent's claim is checked against a kept trace before anything acts on it |
| Save progress | Rewrite the Now section below and `.claude/memory/main.md` in place, then say so in one line |

## Session start

1. This file, then `.claude/memory/main.md`.
2. `docs/INDEX.md`, then `docs/process/dev-flow.md`.
3. The spec under way in `docs/specs/`, if any.
4. `git status`, `git log -n 10 --oneline`.
5. Tell the maintainer in two lines where things stand and the next step.

## Reports

A report to the maintainer holds: what was done; what passed, with the gate's last line, and what was not run; what needs their word; every path changed.

## Now

As of 2026-10-29. Rewritten in place at every milestone and on "save progress"; never appended.

- Version: 0.5.0, released 2026-10-29 (PR #6 merged; the release commit goes up as its own PR). Free gates green on Claude Code 2.1.303 in CI; the maintainer's machine runs 2.1.312 (types refresh not done).
- 0.5.0: call-time guards on megamaid's own agents (write boundaries, the fix reviewer's diff base, brief fit), the model set at spawn, and the baseline's fixes. What is left of Phase 3 is MM-025 (effort and briefs at spawn). The suite ran 6/9 on 2.1.312, then green alone or by replay ([evals/README.md](../../evals/README.md)); the judge once hit a subscription weekly limit with the API key set, cause unknown.
- Done 2026-10-28: the baseline, two `/megamaid:vacu-suck` rounds in the maintainer's parts-bin project (39.19 and 28.88 USD). Orchestrator at about 26% and 36% of cost (45% and 54% of input tokens), so deterministic fix orchestration (MM-028) saves about a quarter of a run; the maintainer weighs it on the quality of the job as well as cost. Figures in [knowledge/costs.md](../knowledge/costs.md).
- Next: deterministic fix orchestration (MM-028) gets its own spec, MM-047 (batches ignore plan order) with it. MM-043 (the orchestrator reads PATTERNS.md now and then) has its second miss; its prompt fix waits on the maintainer.
