# Costs

Observed costs in USD, with the model where known. Both kept suite runs carry the CI pins (`claude-opus-5-5`, judge `claude-sonnet-5-5`); the local eval command itself is in [evals/README.md](../../evals/README.md). Last column as in [engine.md](engine.md).

| Run | USD | Model | Checked |
|---|---|---|---|
| `scripts/smoke.sh` (free gates plus three `claude -p` runs); the module-off turn is most of it | 0.25 | the session default (smoke passes no `--model`) | unverified |
| Eval suite, nine cases (`evals/results/2026-10-14T17-26-56-747Z`: 9/9, 691 s, Claude Code 2.1.299) | 5.23 | Opus 5.5, Sonnet 5.5 judge | machine |
| of which `plan-native-planner` (`arms.with[0].costUsd`) | 0.62 | Opus 5.5 | machine |
| `--case plan-native-planner` alone | about 0.65 | Opus 5.5 | unverified |
| Eval suite, eight cases (`evals/results/2026-10-14T14-41-00-188Z`: 8/8, 567 s, Claude Code 2.1.299) | 4.56 | Opus 5.5, Sonnet 5.5 judge | machine |
| Two-lens spec review | about 2 | Opus 5.5 | unverified |
| Two-lens branch review | about 2.5 | Opus 5.5 | unverified |
| Run-detection live check (Claude Code 2.1.296) | 0.76 | not recorded | unverified |
| Non-code plan live check (Claude Code 2.1.299) | 0.60 | Opus 5.5 | unverified |
| Read-path probe (note on 0.42, note off 0.29) | 0.71 | Opus | unverified |
| Compaction probe | under 0.05 | haiku | unverified |
| Five engine questions by probe mod | under 0.10 together | haiku | unverified |
| One release cycle (spec review, branch review, smoke, live check, suite) | about 10.6 | Opus 5.5 | unverified |
| The three experiments, six runs ([experiments/README.md](../../experiments/README.md)) | 4.88 | Opus 5.5 | unverified |
| CI `evals` job cap (`--max-cost-usd`) | 20 | pinned | code |

## Kept runs

| What | Where | Checked |
|---|---|---|
| Eval runs | `evals/results/2026-10-14T14-41-00-188Z` (8 cases) and `evals/results/2026-10-14T17-26-56-747Z` (9 cases), each `aggregate-result.json` and `report.html`; the folder is gitignored | machine |
| Their temp dirs (`--keep-temp`) | 53 folders under `/private/tmp/e-*`; `plan-native-planner` is `/private/tmp/e-OMNG3T` | machine |
| The forked-from plugin's baseline (6/8, 4.64 USD; both misses grader shape) | its repo under `~/Development/`, `evals/results/2026-10-12T01-29-43-961Z` | machine (folder) |
