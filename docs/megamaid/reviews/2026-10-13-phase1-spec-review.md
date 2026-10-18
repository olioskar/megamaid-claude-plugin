# Phase 1 spec review (rev 1), consolidated

Spec: `docs/superpowers/specs/2026-10-13-megamaid-mod-skeleton-design.md` rev 1. Two lenses, Opus 5.5, read-only, no paid runs.
Contract lens (A): 0 C / 11 I / 14 M. Code and tests lens (B): 3 C / 8 I / 15 M; B built the skeleton in `scratchpad/review-code/repo` and ran validate, plugin test and tsc on it.
Duplicates merged below. IDs: A-I1 = contract Important 1, B-C1 = code Critical 1, etc.

## Critical

| ID | Finding | Fix |
|---|---|---|
| C1 (B-C1, A-I1) | `$.state.set(run, undefined)` is refused at run time ("value is not JSON data"); `tsc` accepts it. `session.end` never clears the run. | `run: MegamaidRun \| null`; clear with `null`; test asserts the written `null`. |
| C2 (B-C2) | The file split fails validate: `$` is not followed across an import, and two `skill.prompt` registrations without a matcher are refused. | `run.ts` exports `registerRun(on)` registering inline; every registration carries a matcher (`{ skill: /^megamaid:/ }`). |
| C3 (B-C3, A-I4) | A throw in any of the plugin's `skill.prompt` hooks discards the strip too (two registrations, inner throws → text unstripped; a `.catch` answering `next(e)` does not help). A run-detection fault becomes a false "module not loaded" stop. A-I4 proposed separate registrations; B's probe shows that does not work. | One `skill.prompt` registration: strip after `next`, then run-start inside `try/catch` (catch logs to debug). Test: run start fails (no `mock.clock`) and the line is still stripped. |

## Important

| ID | Finding | Fix |
|---|---|---|
| I1 (A-I3, B-I1) | Parallel reviewer spawns lose map entries (get/spread/set race; B's test: 5 spawns → 1 entry). | `update($, RUN, fn)` from `claude-code` (ifVersion + retry); parallel-spawn test. |
| I2 (A-I2, B-I8) | Recording by `subagentType` filtered on provider misses role overrides (`agents.<role>.subagent_type`, custom agents from configure, `general-purpose` writer in dispatch-delivery eval) and conflates roles (`code-reviewer` is palette member and fix reviewer). Phase 2/3 need role. | Record every main-loop spawn (`parentAgentId` absent) while a run is current, whatever the provider: `{ subagentType, provider, role }`; `role` parsed from the run-brief path in `e.prompt` (`.megamaid/excerpts/<run>.<skill>.<role>.brief.md`), else `unknown` (scanner, shaver). **Decision D2.** |
| I3 (A-I5) | `$.ui.log` defaults to the transcript: a visible row per run and spawn, against "nothing a user sees changes". | `{ to: "debug" }`. |
| I4 (A-I6, B-M11) | Done-when check matches agentIds against `turn.complete` in the debug log; nothing logs that without a hook. | Spawn line logged after the state write succeeds; agentIds checked against the transcript JSONL's Agent results. **Decision D4.** |
| I5 (A-I7, B-I7) | Smoke module-off check can pass on the engine's own stderr line, fails if the model paraphrases, hand-copies the needle, and has no tool limits. | Stop line tells the model to print a fixed token; smoke: `--output-format stream-json --verbose --disallowedTools Agent Bash Write Edit --max-budget-usd 0.3`; stderr carries the engine's not-loaded line (precondition); stdout final text carries the token (derived from `hooks/stop-line.ts`); no tool_use but Skill. **Decision D3** (wording). |
| I6 (A-I8) | Bound not stated: agents carry no stop line (direct spawns run unguarded); the vacu-suck/fix-auto prose override is unconditional, so it fails open if the module drops mid-session. | "Bound" paragraph. Replace the prose override with a `tool.call` hook on Read of `<plugin root>/skills/*/SKILL.md` that adds `context` ("skip the stop line"); module gone → no context → run stops. **Decision D1.** |
| I7 (A-I9) | Unverified: after compaction, does re-attached skill text bring the stop line back (false stop mid-run)? | Probe before planning (< 0.10 USD). **Decision D5.** |
| I8 (A-I10) | Help remedies miss causes (`plugin.register` refusal, module load error, host where no plugin may shape the run); rollout-switch remedy unverified. | Catch-all: `claude --debug-file <f>` and read the `megamaid:` line; mark the rollout remedy unverified. |
| I9 (A-I11) | Nothing gates the override (line or hook) in vacu-suck/fix-auto. | check-contract §4 extension, or a plugin test if D1 picks the hook. |
| I10 (B-I2) | Kit usage undiscovered: no `$.state` in tests (record via `on('state.set')`); `mock.clock` needed; `ui.log` hook must answer `{ value: undefined }`; spawn fixture needs `parentModel`, `background`, `fork`; `session.end` needs `resume.id`. | Spec names a shared test rig. |
| I11 (B-I3) | Six negative tests pass before code exists, so "fail first" cannot hold. | Each negative test carries a positive control in the same body. |
| I12 (B-I4) | The engine writes `.claude-plugin/types/.gitignore` with `*`; `git add` refuses; later engine-added files stay untracked; root `claude-code-mcp/` ignore is redundant. | `git add -f` the two folders; commit the engine's `.gitignore`; drop the root entry. |
| I13 (B-I5, A-M5) | Unpinned CI CLI vs committed types vs dev's hot reload rewriting them: CI can go red with no repo change. | Pin CI to `@anthropic-ai/claude-code@2.1.296`; check-contract compares the types' "Written by Claude Code X" with `claude --version`; one home for both pins. |
| I14 (B-I6, A-M13) | `claude plugin test` refusals are intermittent and must not pass silently; Linux CI unverified (macOS ran with empty HOME, no auth). Eval job has the same exposure. | Gate requires `Ran N tests … 0 fail` with N ≥ expected and treats a refusal line as failure; first plan task is a CI dry run. |

## Minor

| ID | Finding | Fix |
|---|---|---|
| M1 (A-M1, B-M1) | `PluginState` must be inside `declare module 'claude-code' {}`; no value export; names led by `Megamaid`. | Exact file in spec. |
| M2 (A-M2, B-M6, B-M7) | Imports must be extensionless (`.ts` → TS5097). TS 5.4.5 rejects es2023; 5.5+ passes. | Extensionless; pin `typescript@5.9.3`. |
| M3 (A-M3, B-M8) | Validate prints `gating hook without .catch: agent.spawn`, against the PLAYBOOK wording. | Pass-through `.catch(($, e, next) => next(e))` on the observer; say why. |
| M4 (A-M4, B-M5) | `claude-code-tools/` is per machine/build; local tsc includes ignored `claude-code-mcp/`; engine writes a tsconfig if none exists. | Exclude `claude-code-mcp` in tsconfig; note tools drift; commit the root tsconfig before the maintainer step. |
| M5 (A-M6, B-M9, B-M10) | check-contract header says offline; npx needs network, node and claude on PATH; pin duplicated in PLAYBOOK; release-gate step 3 duplicates step 2. | Update header, clear errors on missing tools, step 3 points at check-contract. |
| M6 (A-M7, B-M2, B-M3) | Stop-line gate: extraction of a literal containing `'`; "first body line" vs blank line after `---`; CRLF. | `export const STOP_LINE = "…"` (one line, double quotes, no escapes, checked); "first non-blank line after the closing `---`"; `.gitattributes` `*.md text eol=lf`. |
| M7 (A-M8) | Stale docs not in the update list: README:7, README Development, existing README `## Requirements` (README:28), smoke.sh:2, PLAYBOOK:43, evals/README:67, plan.md Phase 1 text. | Add to the docs list. |
| M8 (A-M9) | Help Requirements position in the verbatim Overview unspecified. | Name it. |
| M9 (A-M10) | Run never ends in Phase 1: stored run means "last run". | Note for Phase 3. |
| M10 (A-M11) | "Base directory" prefix claim not in the spike findings. | Record (probe A log shows it). |
| M11 (A-M12) | Eval baseline not named; comb 6/8 graded before grader fixes. | Name the comb result folder, compare with replayed results; optional `not_contains` grader for the stop token. |
| M12 (A-M14) | Stop line copied into 7 SKILL.md files: exception to "shared block lives in shared/". | State the exception; gate enforces. |
| M13 (B-M4) | vacu-suck has three Read passages (:63, :92, :101). | Follows D1. |
| M14 (B-M13) | Old-name guard scans ~800 KB of engine types. | Exempt `.claude-plugin/types/`. |
| M15 (B-M14) | `skipLibCheck` skips `types/index.d.ts` (validate checks it); tests cannot use `setTimeout`; tracked types ship to users (~800 KB). | Note; use `mock.clock`. |
| M16 (B-M15) | Smoke may test an installed megamaid instead of `--plugin-dir .`. | Smoke warns if megamaid is installed. |

## Decisions for the maintainer

- **D1** vacu-suck/fix-auto override: prose line (rev 1) or a `tool.call` Read hook adding `context` (fails closed if the module drops).
- **D2** Role attribution: record all main-loop spawns during a run, role from the brief path.
- **D3** Stop-line wording with a fixed token for smoke.
- **D4** Done-when evidence: transcript JSONL vs a debug `turn.complete` line.
- **D5** Compaction probe now (< 0.10 USD).
