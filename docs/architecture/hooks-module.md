# The hooks module

`hooks/hooks.json` loads `hooks/register.ts`, which calls one register function per file. Ten registrations, six event kinds; `usage.ts` registers two, `guards.ts` three, and `tool.call` is split between `read-note.ts` (Read), `guards.ts` (Edit, Write, Bash) and `usage.ts` (Write). Pure helpers without `$`: `run.ts`, `ledger.ts`, `stop-line.ts`, `guard-rules.ts`. What each hook reads and writes, the state fields, the brief-path grammar and the debug log lines: [hook-events.md](../api/hook-events.md). This file holds the why and the mechanism.

## Failure shape per hook

| File | Event | Kind | `.catch` | State touched |
|---|---|---|---|---|
| `skill-prompt.ts` | `skill.prompt` (megamaid:*) | guard | replays `next` and strips again: an overrun cannot cost the strip. Run start sits in `try`; its failure is logged and the strip still returns. | writes `run` |
| `read-note.ts` | `tool.call` Read | observer | pass-through `next(e)`: a fault means no note, and the run stops | none |
| `agents.ts` | `agent.spawn` | guard | `next.called ? next(e)`; else refuses a main-loop briefed spawn (`megamaid: brief check (megamaid guard fault)`) and passes any other, so a user's unrelated spawn is never refused by a fault | reads `run.skill`; reads and writes `run.agents` |
| `guards.ts` | `tool.call` Edit, Write | guard | `next.called ? next(e)`; else passes a main-loop call, refuses a subagent's (`megamaid: write boundary (megamaid guard fault)`) | reads `run.agents[id].boundary` |
| `guards.ts` | `tool.call` Bash | guard | same shape (`megamaid: fix reviewer diff base (megamaid guard fault)`) | reads `run.agents[id]` |
| `usage.ts` | `turn.complete` | observer | logs `usage hook failed: …`, then `next(e)`: a fault means a stale ledger | `run.usage`, `run.agents[id].usage`, `run.lastTurnAt`, `run.owed` |
| `usage.ts` | `tool.call` Write | observer | same; a denied or errored Write is skipped before any state is read | `run.report` |
| `session.ts` | `session.start` | observer | none (the site refuses nothing) | none |
| `session.ts` | `session.end` | observer | pass-through; `next` first because the chain shares one time limit, so the write spends what is left | clears `run` |

Validate's wording for these (`gating hook with .catch` for every hook at a refusing site) is in [engine.md](../knowledge/engine.md). Only the guards return `deny`; each reason is in [hook-events.md](../api/hook-events.md).

## Guards

A guard acts only on megamaid's own work: a `tool.call` guard on a call whose `agentId` is a recorded agent of the stored run, the spawn checks on a main-loop spawn naming a run brief. A nested spawn is not checked, because a reviewer's own Explore may quote the reviewer's brief path. No guard watches the main loop: nothing marks a run's end, so one would refuse the user's own work afterwards. The model and the write-set come from `megamaid.py` run through `$.process.run` before the spawn starts; the boundary is stored on the agent's record after it. A model the dispatch names wins over config, so a user can override one run without editing config.

## State

One slot, `PluginState.megamaid.run`. Every file that reads or writes it declares `const RUN = { plugin: 'megamaid', key: 'run' } as const`, because validate reads a ref only as a literal const of the file that passes it; check-contract §12 keeps the five copies equal. Every write goes through `update($, RUN, fn)`: read, apply, write with `ifVersion`, retry on a miss. Review dispatches its reviewers in one message, so their `agent.spawn` hooks run at once; a plain get-spread-set loses entries. `costAtStart` is null when the host, or the test rig, answers no cost; the run still starts.

## The stop line

`STOP_LINE` (`stop-line.ts`) tells the model that the module is not loaded, to run no tools, and to reply only `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`. Every skill but help carries it as the first non-blank line after the frontmatter, because it must be in the file the engine loads; help is where the module is explained, and its Requirements block names the token and the causes. The `skill.prompt` hook strips it; with no module the model reads it and stops. `stripStopLine` drops every line equal to `STOP_LINE`, tolerating a trailing `\r`; `.gitattributes` forces LF on `*.md` and `*.ts` so a Windows checkout cannot break the match or §11's `sed` extraction. One `skill.prompt` registration on purpose: if a second hook of this plugin threw, the strip would be lost and a loaded module would read as not loaded.

vacu-suck and fix-auto Read sub-skill files (`skills/{review,plan,fix}/SKILL.md`) that open with the line. While the module is loaded, their main-loop Read gets `SKIP_NOTE` in its context; with no module there is no note and the run stops. Any fault in that hook means no note, so the stop stands.

The module makes no version check: one would miss the other causes of a module that did not load (`disableAllHooks`, the rollout switch, a `plugin.register` refusal, a load error). The stop line covers them all.

Known false stops (the model stops although the module is loaded): another plugin's `skill.prompt` hook answering without `next` (unverified); a sub-skill file read through `cat` instead of Read (only the Read tool is hooked); fix-auto or vacu-suck run inside a subagent (its Read carries an `agentId`, so no note); a user-installed plugin under an organization-managed Claude Code, where `skill.prompt` hooks do not run, so the module loads and nothing strips the line (unverified; issues.yaml MM-037: skill.prompt hooks under an organization-managed Claude Code). Not covered: a build without hooks modules may refuse the plugin outright, so no token appears (unverified; issues.yaml MM-018: probe such a build); text the model already read stays in force if the module drops mid-run.

## Run detection

The stored run means "the last run started", not "a run in progress". It starts at `skill.prompt` for every skill but help and ends at the next run or session end. A megamaid skill started inside a subagent replaces it and records no agents (`skill.prompt` carries no `agentId`); later main-loop spawns then land under the subagent's skill (issues.yaml MM-020: a run per loop needs an engine change). Nothing that reads the run may take it for the active main-loop run.

`agent.spawn` records only megamaid's own main-loop dispatches, because recording every spawn would attribute unrelated later spawns to the last run: a prompt naming a run brief; a spawn whose `provider.plugin` is `megamaid` while the stored run is `megamaid:patterns` (the briefless scanner and shaver; an overridden one is not recorded, issues.yaml MM-021: revisit when patterns gets a brief); a spawn whose `parentAgentId` is a recorded agent, recorded under the parent's lane, role and stem. A spawn nested in an unrecorded agent is ignored. A brief-carrying spawn with no stored run (after `/clear`, or a hand dispatch) starts a synthetic run with `skill: 'none'`.

## Usage and the ledger

What the file looks like for a user: [usage-ledger.md](../features/usage-ledger.md). The mechanism:

- Usage is stored per agent (`agents[id].usage`) and for the main loop (`run.usage`); `renderLedger` folds it per key: `orchestrator` for the main loop, `<lane>/<role>` for a briefed agent, the `subagentType` for a briefless one. A `turn.complete` with an unrecorded `agentId` counts nowhere; a stored run with no `usage` field is left uncounted.
- Run end is the next run's start or session end because no earlier signal is trustworthy: a main-loop turn that ends on text is a question as often as the run's last answer (review's scope question, fix's dirty-tree pre-flight, vacu-suck's "run again?"), and a background agent's completion raises a main-loop turn of its own. So the ledger counts main-loop turns until then, but only owed ones (`run.owed`): the first is owed at run start; a recorded spawn (`addAgent`), a recorded agent's counted turn, and the report Write each owe the next; a counted main-loop turn clears it. Chat after the run's last answer counts nowhere. The one turn this misses is a main-loop answer to the run's own question that dispatches nothing ("run again?" answered no). A run stored without the field (0.4.0 across a hot reload) reads as owed. A sweep's "run again" is the same run: `report` is set once and the totals cover every round.
- The report is found by a main-loop `tool.call` of Write, neither denied nor errored, whose basename matches `REPORT_NAME` (`ledger.ts`), the same shape `megamaid.py report-name` prints, kept equal by check-contract §5. A subagent's Write is ignored.
- Placement (`ledgerPath`): beside the report for review and vacu-suck, `-usage.md` for `-report.md`, nothing until the report exists; `.megamaid/usage/<skill>-<startedAt>.md` for every other run, with `.megamaid/.gitignore` (`*`) written first when absent. Plan and fix ledgers do not learn `paths.*` from the config call (parsing a tool result) or from lane Reads.
- The cost line is `$.session.usage().cost.usd` at the last counted turn minus `costAtStart`; "unavailable" when either is null. No price table, so no per-role USD; the split is two shares (input incl. cache; output) because the two price classes differ by an order of magnitude.
- The ledger is rewritten whole from state on every write, never appended. Two agents ending at once may write out of order; the last writer wins until the next main-loop turn, which always ends last. A run starting between a hook's `state.get` and its `update` attributes one turn to the new run.
- `manifest.py clean` removes `excerpts/<stem>*` only, so ledgers under `.megamaid/usage/` stay; a ledger beside the report is committed with the report; fix's per-item commits stage the implementer's files by name and never pick it up.
- No config knob: the ledger is a measurement, not a behaviour.

## Bounds

| Bound | Status |
|---|---|
| A report produced by a shell heredoc or Edit raises no Write call; the ledger never lands. Review Step 8 pins the Write tool; every kept trace uses it. | prose only; no guard covers it |
| A guard sees only the tools it hooks: an implementer writing through Bash (`sed -i`, a redirect) passes the write boundary; fix 4d.1's git checks stop the item. | by design |
| A guard knows an agent once its spawn record lands; a call before that passes. | not seen: no turn before its record in the baseline's 84 spawns |
| A fault in a `tool.call` guard's state read refuses that subagent call, another plugin's included; the agent sees the reason and can retry. A user's own agent dispatched with a megamaid brief is guarded as a megamaid dispatch. | by design |
| A model the session forces on every subagent outranks the spawn's; an orchestrator that passes a model nobody asked for wins over config, and only the prose checks that. | types; prose |
| The engine raises `agent.spawn` for a subagent's spawn to this hook (nested attribution rests on it). Symptom: an agent row's Agents below the trace's Agent calls. | unverified live; issues.yaml MM-014: the baseline ran no nested spawn ([costs](../knowledge/costs.md)) |
| An agent whose turn ends before its spawn record lands counts nowhere. Symptom: Turns below Agents. | not seen live: 84 agents in the baseline, 17 spawned within 0.6 s ([costs](../knowledge/costs.md)) |
| `$.plugin.root` equals `${CLAUDE_PLUGIN_ROOT}` for a marketplace-installed copy (the Read note keys on it; the guards run `megamaid.py` from it). | unverified; issues.yaml MM-016: probe an installed copy |
| The stripping `.catch` on `skill.prompt`: a budget overrun cannot be simulated, so removing it passes every test. A throw from `next` itself, or a throwing `.catch`, passes the text unstripped and the model stops. | untested; issues.yaml MM-017: no action until the kit can simulate it |
| Only the two writer roles withhold `Agent`; reviewers may spawn, and those spawns are nested rows. | verified (agent frontmatter) |
| Usage is counted only while the module is loaded; a session cost from the host is optional. | verified (code) |

Test kit quirks the tests depend on: [test-kit.md](../knowledge/test-kit.md). Live checks of run detection: [live-checks.md](../knowledge/live-checks.md).
