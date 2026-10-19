# Usage ledger

The hooks module writes a Markdown ledger of what a run cost, per role, as the run goes. It has no config knob: it is a measurement, not a behaviour.

## Where it lands

| Command | Path |
|---|---|
| `/megamaid:review`, `/megamaid:vacu-suck` | beside the report and named like it: `pr-12-round1-report.md` gets `pr-12-round1-usage.md`; written once the report exists |
| plan, fix, fix-auto, patterns, configure | `.megamaid/usage/<command>-<start>.md`, `<start>` in epoch milliseconds (`.megamaid/` ignores itself in git) |

A review or sweep that ends before its report is written has no ledger. A sweep's "run again" rounds stay in the first ledger; its totals cover every round.

## What it says

```
# megamaid usage: megamaid:review

Run: started <ISO>, last turn <ISO> (UTC)
Cost: 1.42 USD (…)

| Lane/role | Agents | Turns | Input | Cache read | Cache write | Output | Model |
```

| Column | Meaning |
|---|---|
| Lane/role | `orchestrator` first (the session's main loop); `<lane>/<role>` per briefed agent role (`review/code-reviewer`, `plan/planner`, `fix/implementer`); the agent type for the patterns scanner and shaver; `total` last |
| Agents | dispatches summed into the row |
| Turns | turns counted into the row |
| Input, Cache read, Cache write, Output | tokens, summed |
| Model | the models the row's turns reported |

Below the table the orchestrator's share of input and of output tokens (the line's exact form: [working-paths.md](../api/working-paths.md)). The cost line is the session's spend at the last counted turn minus its spend at run start, so it includes anything else done in the session meanwhile; there is no per-role cost, and it reads `unavailable` when either figure is missing. An agent a reviewer spawns counts under the reviewer's row.

## When it stops changing

A run ends at the next megamaid command other than help, or at session end (`/clear` included). Until then a main-loop turn is added to the orchestrator row only when the run did something since the last counted one: the run's first turn always counts; a dispatch, a dispatched agent's turn, or the review report's Write owes the next one. Chat after the run's last answer adds nothing. One turn can slip through: a main-loop turn that answers a question of the run without dispatching (vacu-suck's "run again?" answered no) is not counted.

Exact format and paths: [../api/working-paths.md](../api/working-paths.md). How the counting works: [../architecture/hooks-module.md](../architecture/hooks-module.md).
