# Costs

Observed costs in USD, with the model where known. Both kept suite runs carry the CI pins (`claude-opus-5-5`, judge `claude-sonnet-5-5`); the local eval command itself is in [evals/README.md](../../evals/README.md). Last column as in [engine.md](engine.md).

| Run | USD | Model | Checked |
|---|---|---|---|
| Baseline, `/megamaid:vacu-suck` round 1 in a real project (parts-bin, branch `vacu-suck/tooling`, 2026-10-28, Claude Code 2.1.312): 26 findings, 17 plans, 16 items committed, 53 agents; the ledger's `Cost` line, most likely on the plan (no API key set) | 39.19 | Opus 5.5 | machine |
| The same, round 2 (a rerun with three carried-in findings): 15 findings, 9 items committed, 31 agents | 28.88 | Opus 5.5 | machine |
| `scripts/smoke.sh` (free gates plus three `claude -p` runs); the module-off turn is most of it. Ran green for 0.4.0 on 2026-10-19 (Claude Code 2.1.303, the owed-turn module); its cost is not printed | 0.25 | the session default (smoke passes no `--model`) | unverified |
| Eval suite, nine cases (`evals/results/2026-10-14T17-26-56-747Z`: 9/9, 691 s, Claude Code 2.1.299) | 5.23 | Opus 5.5, Sonnet 5.5 judge | machine |
| of which `plan-native-planner` (`arms.with[0].costUsd`) | 0.62 | Opus 5.5 | machine |
| Eval suite, nine cases, unpinned, on an API key (`evals/results/2026-10-18T23-42-38-410Z`: 8/9, 832 s, Claude Code 2.1.303; `manifest-slice` missed `orchestrator-never-reads-manifest`, MM-043) | 4.53 | not recorded (the local command floats) | machine |
| `--case manifest-slice --keep-temp` alone, unpinned, on an API key (`evals/results/2026-10-19T00-13-42-695Z`: 1/1, 123 s) | 0.84 | not recorded | machine |
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

## Baseline: orchestrator share

From the two ledgers of the baseline run (rows above); the ledgers and debug logs stay in that project (`docs/megamaid/reviews/branch-vacu-suck-tooling-round{1,2}-usage.md`, `/tmp/megamaid-live.log` and `.log.1`). Share of input tokens counts input, cache read and cache write; the cost-weighted share uses list-price ratios (cache read 0.1, cache write 1.25, output 5).

| Round | Orchestrator turns | Share of input tokens | Share of output tokens | Cost-weighted share | Checked |
|---|---|---|---|---|---|
| 1 | 43 | 45% | 19% | about 26% | machine (ledger); unverified (weighting) |
| 2 | 30 | 54% | 19% | about 36% | machine (ledger); unverified (weighting) |

Against the ideation estimate (20 to 35%) both rounds are above it, so deterministic fix orchestration (MM-028) pays for tokens. Every row's `Agents` equals the debug logs' `spawned as` lines for its time window and `Turns` never falls below `Agents` (84 agents, 17 planners within 0.6 s); no subagent spawned, so nested attribution (MM-014) was not exercised.

## Kept runs

| What | Where | Checked |
|---|---|---|
| Eval runs | `evals/results/2026-10-14T14-41-00-188Z` (8 cases), `evals/results/2026-10-14T17-26-56-747Z` (9 cases), `evals/results/2026-10-18T23-42-38-410Z` (9 cases, 8/9) and `evals/results/2026-10-19T00-13-42-695Z` (`manifest-slice` alone), each `aggregate-result.json` and `report.html`; the folder is gitignored | machine |
| The `manifest-slice` re-run's sandbox (`--keep-temp`, sealed; `chmod 700` it to inspect, never run git inside) | `/private/tmp/e-WPukmN` | machine |
| Their temp dirs (`--keep-temp`) | 53 folders under `/private/tmp/e-*`; `plan-native-planner` is `/private/tmp/e-OMNG3T` | machine |
| The forked-from plugin's baseline (6/8, 4.64 USD; both misses grader shape) | its repo under `~/Development/`, `evals/results/2026-10-12T01-29-43-961Z` | machine (folder) |
