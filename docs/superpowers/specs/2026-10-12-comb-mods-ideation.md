# comb × mods — ideation (2026-10-12)

Status: ideation, not a spec. Feeds the mods-based successor plugin (name and repo TBD).
Grounded against Claude Code 2.1.296's bundled plugin-authoring types (`claude-code.d.ts`).

## How mods work (primer)

A mod is a plugin. Same folder shape as any plugin (`.claude-plugin/plugin.json`), plus:

- `hooks/hooks.json` → `{ "modules": ["./register.tsx"] }` (function hooks, not the classic shell-command hooks)
- `hooks/register.tsx` → `export const register: Register = (on, options) => { ... }`
- optional `types/index.d.ts` contract for `$.state` values or a noun added to `$`, named as `"types"` in plugin.json

`on(event, matcher?, ($, e, next) => …)`:
- `$` = engine interface (ui, model, fs, process, store, state, clock, tool, agent, command, …)
- `e` = frozen event input
- `next(e)` = plugins beneath, then the engine's own behaviour. Return without `next` = answer yourself; `next({...e, x})` = rewrite; `await next(e)` = react to the result.
- Runs in its own environment: no DOM, no Node. Everything outside goes through `$`.
- Guards should be written `on(...).catch(($, e, next) => next.called ? next(e) : { deny: 'why' })`, otherwise a throwing guard lets the call through.

Composition with the rest of a plugin: skills, `agents/*.md`, commands and a hooks module live in the same plugin. Mods can also register tools (`mcp__<plugin>__<name>`) and agent types (`<plugin>:<name>`). Plugins stack through `next`.

Dev loop: `claude --plugin-dir <folder>` or `CLAUDE_CODE_PLUGIN_DIRS`; interactive sessions hot-reload on save. Gates: `claude plugin validate`, `tsc -p <folder>` (types laid in `.claude-plugin/types/` once loaded), `claude plugin test` (`*.test.ts`). Sharing: `.claude-plugin/marketplace.json` + `/plugin install <mod> --marketplace <owner>/<repo>`; or an entry in an existing marketplace.

## API facts checked against the types

- `tool.call` input carries `agentId` (the loop the call is in) → per-agent guards are possible.
- `agent.spawn` input: `prompt`, `description`, `subagentType`, `model`, `parentModel`, `parentAgentId`, `tool_use_id`, `provider`. A hook may rewrite `prompt`, `subagentType`, `model`, or refuse with `{ deny }`.
- `turn.complete` carries `agentId` and `usage` (per agent loop) and `reason` (`answer | aborted | refusal | error`).
- `skill.prompt` input `{ skill, text }`; a hook returns the text the model reads for that skill.
- `$.agent.spawn({ subagentType })` runs an agent from code; its answer is its own `turn.complete`.
- `$.process.spawn({ argv })` runs a child process (so a mod can call `python3 scripts/comb.py` or `git`).
- `session.end` fires on exit and on `/clear` (`reason: 'clear'`).

Unverified: whether a hook can see or gate a skill marked `disable-model-invocation`; what an older Claude Code build does with a `modules` hooks file.

## Ideas

### A. Turn prose rules into call-time guarantees
1. **Implementer file boundary** — remember `comb:implementer` spawns' `agentId`; deny Edit/Write/NotebookEdit from that loop outside the instruction's named files. 4d.1 git checks become a backstop; a stray edit never lands, so no revert-and-retry.
2. **Orchestrator never reads PATTERNS.md** — deny Read/`cat` of the manifest from the main loop during a run; point at the excerpt. Grader `orchestrator-never-reads-manifest` becomes a test of a guarantee.
3. **Fix reviewer never `HEAD~`** — deny/rewrite that Bash in reviewer loops (grader `reviewer-never-head-tilde`).
4. **Models/effort applied at spawn** — `agent.spawn` sets `model` from resolved config and normalizes full ids → aliases (the v0.15.1 enum finding). `model-passed` graders stop depending on orchestrator compliance.

### B. Move dispatch plumbing out of prose
5. **Brief injection** — `agent.spawn` on `comb:*` agents prepends the shared context block and "Read these first: …" paths.
6. **Fix gate by config** — `fix.model_invocation` + `fix-auto` exist because frontmatter is static; a hook could gate on config and `fix-auto` could go. (Unverified, see above.)
7. **Config at skill load** — `skill.prompt` injects resolved config, replacing each skill's "run comb.py, stop if it fails" step. Via `$.process` → python3, or port to TS.

### C. Visibility
8. **Fix / the-desert pane** — items × batch × implementer/reviewer state × attempts × commit, from `agent.spawn` + `turn.complete` keyed by `agentId`. Needs dispatch descriptions that name the item.
9. **Status line** — `comb: fix 3/7`.
10. **Per-run cost ledger** — sum `turn.complete` usage per role; write beside the report. Real-run numbers for calibration and effort decisions.

### D. Robustness
11. **Excerpt cleanup** — delete `.comb/excerpts/<run>.*` on `session.end` / aborted turn.
12. **Interrupted fix** — on `aborted` mid-batch, notice naming the item in flight and dirty paths.

### E. Deterministic orchestration (the big one)
Drive fix batching/dispatch/verification/commit from code with `$.agent.spawn` + `$.process`, leaving the model only the judgment steps. Largest token saving; also a rewrite.

## Constraints to settle
- **Version floor.** A guard that doesn't load is a silent gate, which violates "correctness properties don't get knobs / can't fail silently". A separate successor plugin can require a mod-capable Claude Code and drop the prose fallbacks; v1 `comb` stays the plugin for older builds.
- **Run detection.** Shared by A–C: set state on `skill.prompt` for the plugin's skills; identify agents by `agent.spawn` `subagentType`/`provider`. Design once.

## Token estimate (rough, unmeasured)
Assumed split today: subagents ~65–80% (diff/code/directives/excerpts), orchestrator ~20–35% (~20k tokens of skill + shared text re-sent each of dozens of turns; per-item git checks; dispatch prompts written as output).

| Change | Saves | Size |
|---|---|---|
| Mechanics → hooks (config, delivery, models, cleanup, fix gate) | ~30–40% of skill text per turn | small (cached input ~10% price) |
| Git checks/verification in code | several orchestrator round trips per item + context growth | medium |
| Brief injection at spawn | orchestrator output tokens (~5× input price) | small–medium |
| Boundary guard | avoided revert+retry (full implementer+reviewer run each) | variable, large per hit |
| Fix orchestration via `$.agent.spawn` | most of the fix-phase orchestrator | large |

Totals: hooks only (A, B, D) ~10–15%; plus E ~20–30%. Beyond that = smaller subagent reads (prompt work, not mods).
Measure first: idea #10 on one ordinary `/comb:the-desert` run gives the real split. If orchestrator < 20%, only E is worth it for tokens.

Recommended pilot: #1 + #4 (they prove run detection), or #10 for the cheapest visible win.
