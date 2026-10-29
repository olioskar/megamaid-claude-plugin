# Working paths

Every path the plugin writes in a user's project. `<paths.*>` are config keys ([config.md](config.md)), relative to the project root. `.megamaid/` is relative to a cwd: the scripts run from the project root as the skills instruct; the hooks' relative `$.fs` paths resolve against the session cwd (unverified for `claude plugin eval`, [../knowledge/engine.md](../knowledge/engine.md)).

| Path | Writer | Removed |
|---|---|---|
| `.megamaid/.gitignore` (one line, `*`) | `megamaid.py:444-452` and `manifest.py:77-84` on first use; `hooks/usage.ts:73` before a ledger under `.megamaid/` | never; keeps everything under `.megamaid/` out of git |
| `.megamaid/excerpts/<run stem>.<skill>.<role>.brief.md` | `megamaid.py brief` | `manifest.py clean --run <run stem>` at the end of the run |
| `.megamaid/excerpts/<run stem>.md` (manifest excerpt) | `manifest.py excerpt` | same |
| `.megamaid/excerpts/<run stem>.index.json`, `<run stem>.edits-<n>.json`, `<run stem>.passing.json`, `<run stem>.final.json` | `manifest.py index`; the pattern shavers; `manifest.py verify`; `manifest.py filter` (patterns `--shave`) | same |
| `.megamaid/excerpts/patterns-draft.md` | the patterns orchestrator, for `manifest.py anchors` | `rm -f` by the same skill (`skills/patterns/SKILL.md:266`) |
| `.megamaid/usage/<skill>-<startedAt>.md` | `hooks/usage.ts` for a `plan`, `fix`, `fix-auto`, `patterns`, `configure` or synthetic `none` run; `<startedAt>` is the run's `$.clock.now()` in ms | never (`clean` touches `excerpts/` only) |
| `<paths.reviews>/<report prefix>-round<R>-report.md` | review and vacu-suck, named by `megamaid.py report-name` | never |
| `<paths.reviews>/<report prefix>-round<R>-usage.md` | `hooks/usage.ts` once the report's Write is seen | never; committed with the report |
| `<paths.plans>/plan-for-<report basename>/<CODE>-<slug>.md` | plan's planner, one file per finding (`C`, `H`, `M`, `L`, `T`, `D` codes; `G<n>` for an accepted group); fix appends `## Attempts` after a reviewer FAIL (`skills/fix/SKILL.md:297`) | never |
| `<paths.plans>/plan-for-<report basename>/revise-<spec stem>.md` | plan's planner for a non-code report (one file, no per-finding files) | never |
| `<same folder>/X<n>-<slug>.md` | fix's planner for an issue the fix reviewer discovers (`skills/fix/SKILL.md:305`) | never |
| `<paths.patterns>` (`docs/megamaid/PATTERNS.md`) | patterns; `migrate manifest` | never |
| `~/.claude/megamaid.config.json`, `<project>/.claude/megamaid.config.json` | configure, after the user confirms the diff | never |

Names: `<run stem>` is `<skill>-<epoch seconds>-<4 hex>` (`megamaid.py:455-456`). `<report prefix>` is `pr-<N>` or `branch-<slug>`, `<R>` 1 + the highest round among matching filenames in `<paths.reviews>` (`megamaid.py:544-561`). `<report basename>` is the report's filename without `.md`, so `docs/megamaid/reviews/pr-123-round1-report.md` plans into `docs/megamaid/plans/plan-for-pr-123-round1-report/`. Which rounds of a sweep share one ledger is [../features/usage-ledger.md](../features/usage-ledger.md).

## Usage ledger format

Rendered whole from state on every counted turn (`hooks/ledger.ts:67-102`), never appended. What the numbers mean is [../features/usage-ledger.md](../features/usage-ledger.md).

| Part | Content |
|---|---|
| Line 1 | `# megamaid usage: <qualified skill>` |
| Run line | `Run: started <ISO>, last turn <ISO \| none yet> (UTC)` |
| Cost line | `Cost: <n.nn> USD (session spend from run start to the last counted turn; includes anything else in the session meanwhile)` or `Cost: unavailable (no session cost at run start or now)` |
| Table | columns `Lane/role`, `Agents`, `Turns`, `Input`, `Cache read`, `Cache write`, `Output`, `Model`; `orchestrator` first with `Agents` `-`; one row per usage key in first-spawn order; `Model` lists each loop's last model, distinct, first seen first, `-` when none |
| Total row | `total`, agent count, sums, empty model cell |
| Share line | `Orchestrator share: <p>% of input tokens, <q>% of output tokens.` with input = input + cache read + cache write; rounded; `0%` on a zero total |

The example `hooks/ledger.test.ts:12-32` renders:

```
# megamaid usage: megamaid:review

Run: started 1970-01-01T00:00:00.000Z, last turn 1970-01-01T00:01:01.000Z (UTC)
Cost: 2.50 USD (session spend from run start to the last counted turn; includes anything else in the session meanwhile)

| Lane/role | Agents | Turns | Input | Cache read | Cache write | Output | Model |
|---|---|---|---|---|---|---|---|
| orchestrator | - | 3 | 100 | 900 | 0 | 60 | m |
| review/code-reviewer | 3 | 2 | 150 | 0 | 50 | 20 | m |
| review/simplifier | 2 | 3 | 100 | 100 | 0 | 20 | m, n |
| total | 5 | 8 | 350 | 1000 | 50 | 100 |  |

Orchestrator share: 71% of input tokens, 60% of output tokens.
```
