# Hook events

`hooks/hooks.json` loads one module, `hooks/register.ts`, which registers ten hooks. Why the module is shaped this way is [../architecture/hooks-module.md](../architecture/hooks-module.md); engine quirks are [../knowledge/engine.md](../knowledge/engine.md). The guards (`agents.ts`'s spawn checks, `guards.ts`) refuse a megamaid agent's out-of-bounds call and fail closed; every other hook refuses nothing, and its fault means a missing note, a missing record or a missing ledger.

## Registrations

| Event | Filter | File | Does |
|---|---|---|---|
| `skill.prompt` | `{ skill: /^megamaid:/ }` | `hooks/skill-prompt.ts` | strips the stop line from the skill text; for every skill but `megamaid:help` starts a run in state (`costAtStart` from `$.session.usage()`, null when unavailable) |
| `tool.call` | `{ tool: 'Read' }` | `hooks/read-note.ts` | on a main-loop Read of `<plugin root>/skills/<name>/SKILL.md` (realpaths), `<name>` in `STOP_SKILLS`, result neither denied nor errored, adds the Read note to the result's `context` |
| `agent.spawn` | none | `hooks/agents.ts` | for a main-loop spawn whose prompt names a run brief: runs `megamaid.py resolve` for the brief's role and lane (`--coerce vacu_suck` in a sweep) and refuses the spawn when its `subagentType` differs from config's, else sets config's model when the call names none; then records it, with the boundary below for a fix implementer or a planner. Also records a megamaid-provided spawn while the stored run is `megamaid:patterns`, and a spawn nested under a recorded agent under the parent's lane, role and stem (no check, no model, no boundary) |
| `tool.call` | `{ tool: 'Edit' }`, `{ tool: 'Write' }` | `hooks/guards.ts` | refuses a recorded agent's Edit or Write outside its `boundary`: a fix implementer's write-set (a relative entry resolved against `Repository:`, an absolute one as spelled; a directory entry covers what is under it), a planner's output file; an empty boundary refuses every edit. Paths are compared with symlinks resolved, through the nearest existing parent |
| `tool.call` | `{ tool: 'Bash' }` | `hooks/guards.ts` | refuses a recorded fix-lane agent other than the implementer a command holding `HEAD~` or `HEAD^` |
| `turn.complete` | none | `hooks/usage.ts` | adds the turn's usage to the orchestrator (no `agentId`) or to a recorded agent; writes the ledger |
| `tool.call` | `{ tool: 'Write' }` | `hooks/usage.ts` | in a `megamaid:review` or `megamaid:vacu-suck` run, the main loop's first successful Write of a file named `<pr-N\|branch-…>-round<N>-report.md` sets `run.report` and writes the ledger beside it |
| `session.start` | none | `hooks/session.ts` | logs `module loaded` |
| `session.end` | none | `hooks/session.ts` | sets the run to `null` (`/clear` ends a session too) |

`STOP_SKILLS` = `configure`, `fix`, `fix-auto`, `patterns`, `plan`, `review`, `vacu-suck` (`hooks/stop-line.ts:7`). How state writes are made safe under concurrent spawns is [../architecture/design-rules.md](../architecture/design-rules.md).

## `PluginState.megamaid.run`

Declared in `types/index.d.ts`; `MegamaidRun | null`. The stored run is the last run started, not an active one.

| Field | Type | Set |
|---|---|---|
| `id` | `string` | `crypto.randomUUID()` at run start |
| `skill` | `string` | the qualified skill (`megamaid:review`, …); `none` for a synthetic run started by a brief-carrying spawn with no stored run |
| `startedAt` | `number` | `$.clock.now()` (ms) at run start |
| `agents` | `Record<agentId, MegamaidAgent>` | one entry per recorded spawn |
| `usage` | `MegamaidUsage` | the orchestrator's (main-loop) usage; starts at zero |
| `report` | `string \| null` | the review report path once its Write is seen; null otherwise |
| `costAtStart` | `number \| null` | `$.session.usage().cost.usd` at run start; null when the host has no cost or the call fails |
| `lastTurnAt` | `number \| null` | `$.clock.now()` at the last counted turn |
| `owed` | `boolean` (absent on a run stored by 0.4.0) | true while the next main-loop turn counts: set at run start, by a recorded spawn, a recorded agent's counted turn and the report Write; cleared by a counted main-loop turn |

`MegamaidAgent`:

| Field | Type | Set |
|---|---|---|
| `subagentType` | `string` | `e.subagentType` of the spawn |
| `provider` | `string` | `e.provider.plugin` |
| `role` | `string` | the brief's role; `unknown` when briefless; the parent's for a nested spawn |
| `lane` | `string \| null` | the brief's lane; null when briefless |
| `runStem` | `string \| null` | the brief's stem; null when briefless |
| `parent` | `string \| null` | the recorded parent's agentId for a nested spawn, else null |
| `seq` | `number` | spawn order within the run, 0-based (`hooks/run.ts:31-33`); keys of `agents` are not ordered |
| `usage` | `MegamaidUsage \| null` | null until the agent's first counted turn |
| `boundary` | `MegamaidBoundary \| null`, absent on a nested record or a run stored before the field | a fix implementer's `{ kind: 'write-set', root, paths, note }` from `Repository:`, `Instruction file:` and `megamaid.py write-set`; a planner's `{ kind: 'output-file', root, paths: [<Output file>], note }`; empty `paths` with the reason in `note` when a line is missing or `write-set` fails; null for any other agent |

`MegamaidUsage`: `turns`, `input`, `cacheRead`, `cacheWrite`, `output` (integers summed per turn, `hooks/ledger.ts:15-24`), `model` (the last counted turn's model, or null).

## Brief-path grammar

`agent.spawn` parses the spawn prompt with `hooks/run.ts:18`:

```
\.megamaid[\\/]excerpts[\\/]([a-z][a-z-]*-[0-9]+-[0-9a-f]{4})\.([a-z][a-z-]*)\.([^\s\\/]+?)\.brief\.md
```

That is `.megamaid/excerpts/<stem>.<lane>.<role>.brief.md`, either separator, anywhere in the prompt: `<stem>` is `<skill>-<digits>-<hex4>` as `megamaid.py brief` mints it; `<lane>` is the brief's skill (`review`, `plan`, `fix`); `<role>` is whatever stands between `<lane>.` and `.brief.md` (role names are config keys). A brief path inside a nested spawn's prompt is not parsed. The usage key of an agent is `<lane>/<role>`, or its `subagentType` when briefless (`hooks/ledger.ts:27-29`).

## Debug log

Each line is written with `$.ui.log(…, { to: 'debug' })`; the engine prefixes `[megamaid]` (`scripts/smoke.sh:28` greps for it). See them with `claude --debug-file <f>`.

| Line | File | When |
|---|---|---|
| `module loaded (Claude Code <version>)` | `session.ts:10` | every session start |
| `run <skill> started (<id>)` | `skill-prompt.ts:20` | a run skill's `skill.prompt` |
| `run detection failed: <message>` | `skill-prompt.ts:23` | the run start threw; the strip still happened |
| `<lane>/<role> spawned as <subagentType> (<agentId>)` | `agents.ts:72` | a recorded main-loop spawn; `-/unknown` when briefless |
| `<lane>/<role> nested spawn <subagentType> (<agentId>) under <parentId>` | `agents.ts:52` | a spawn nested under a recorded agent; lane `-` when the parent has none |
| `resolve <lane>/<role> exited <n>: <stderr line>` | `agents.ts:85` | a briefed spawn's `resolve` failed (role or lane not in config); the spawn passes unchecked, with its own model |
| `usage <key> +<input>/<output> (<turns>)` | `usage.ts:41` | a counted turn; `<key>` is `orchestrator` or the agent's usage key; `<input>` counts what the ledger's share line counts ([working-paths.md](working-paths.md)); `<turns>` the key's total so far |
| `ledger <path>` | `usage.ts:78` | the ledger file was written |
| `ledger failed: <message>` | `usage.ts:80` | the write threw |
| `usage hook failed: <message or kind>` | `usage.ts:64` | a usage hook threw; the hook chain beneath is replayed |

## Deny reasons

Each names the rule and what to do instead (`hooks/guard-rules.ts`): outside the write-set (the set is named), an empty write-set (the instruction is defective), outside the planner's output file, each ending "stop, change nothing more, and report it as a divergence"; a diff past `HEAD` (gives `git diff HEAD -- <files reported by implementer>`); a brief for another agent (names the roles config maps to the spawned agent and the `megamaid.py brief` command). A guard fault refuses with `<rule> (megamaid guard fault)`.

## Stop line and Read note

Every skill but help opens with the stop line (`hooks/stop-line.ts:3`), verbatim:

> STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`.

The module strips it in `skill.prompt`; without the module the model reads it and answers with the token line `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help` (`STOP_TOKEN`, `TOKEN_LINE`). vacu-suck and fix-auto Read other skills' `SKILL.md` files, which open with the same line; the Read note added as `context` is `hooks/stop-line.ts:6`, verbatim:

> megamaid's hooks module is loaded; the STOP line at the top of this file does not apply.

Causes of a false stop and what the gate checks about the line are [../architecture/gates.md](../architecture/gates.md) and [../knowledge/live-checks.md](../knowledge/live-checks.md).
