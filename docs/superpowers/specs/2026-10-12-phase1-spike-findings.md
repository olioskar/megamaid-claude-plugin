# Phase 1 spike findings (2026-10-12)

Claude Code 2.1.296, macOS. Throwaway probe mod `mmprobe` in the session scratchpad (not kept), run with `claude -p --plugin-dir` on haiku, and one `claude plugin eval --case help-overview` on a repo copy carrying a probe module. Total spend under 0.10 USD.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Does `claude plugin eval` load the hooks module? | Yes. `session.start` and `skill.prompt megamaid:help` fired inside the eval run; the rewritten skill text is in the trace. The module's `$.fs.write` reached a path outside the eval sandbox. | eval-probe.log; `trace.jsonl` holds the marker |
| 2 | Do `tool.call` hooks fire inside subagent loops, with that loop's `agentId`? | Yes. `agent.spawn`'s result carries `agentId`; the subagent's Bash call and its `turn.complete` carry the same id. `provider` is `{ plugin: "mmprobe@inline", tier: "user" }`; `subagentType` is `mmprobe:worker`. | probe B log |
| 3 | Can `$.process` run `python3` and `git`? | Yes (`$.process.run`), from `session.start`, cwd = session cwd. git found on PATH (2.56.0). | probe A log |
| 4 | Can a hook see or gate a `disable-model-invocation` skill? | See: yes. `/mmprobe:dmi` raises `skill.prompt` with `skill: "mmprobe:dmi"` (plugin-qualified), and a rewrite reaches the model. A slash invocation raises no `tool.call`. Gate: a model's Skill tool call raises `tool.call { tool: "Skill", skill }` and `{ deny }` refuses it, so a plugin skill can drop `disable-model-invocation` and be gated by a hook instead. | probes A, B |
| 5 | How is the minimum Claude Code version stated and checked? | No version field in the types or manifest. `$.session.version()` answers `{ version, base, builtAt }` at run time. The bigger finding: the module can fail to load on a mod-capable build. `disableAllHooks: true` in settings, or a stale rollout switch ("hooks modules are turned off for installed plugins in this process"), skips the module; the skills still run, unguarded. In `-p` one stderr line says so; nothing tells the model. | probe A with `--settings '{"disableAllHooks":true}'`; `claude plugin test` refusal earlier in the session |

Other facts:

- A background subagent's completion starts a second main-loop turn: the main loop can raise several `turn.complete`s per user prompt. Phase 2 must sum per run, not per turn.
- `claude plugin test` runs `*.test.ts` against the engine; it refuses to run while the rollout switch is saved off.
- The engine lays `.claude-plugin/types/` only for folders an interactive session hot-reloads. `-p`, CI and `plugin test` do not. The types live inside the native binary (bundled skill extracted to `$TMPDIR/claude-*/bundled-skills/<version>/`); the npm package is platform binaries only. `tsc` in CI needs a committed copy.
- `claude plugin validate` reports gating hooks with and without `.catch`, and rejects `$.ui.log?.(…)` (a `$` event must be called directly).

Implication for the design: "a guard that does not load would be a silent gate" is real on mod-capable builds too, so Phase 1 needs a load check that fails closed, not only a version floor.

## Addendum 2026-10-13: compaction

Asked by the spec review (A-I9): does skill text re-attached after compaction bring a stripped line back? Probe: a skill body with a marker line that the `skill.prompt` hook strips; `/mmprobe:dmi`, then `/compact` (a `compact_boundary` is in the transcript), then a question asking for the skill's instructions verbatim, all in one session resumed with the module loaded. The marker appears nowhere in the transcript, and the re-attached skill text after the boundary is the stripped text. The skill text as the model reads it starts with `Base directory for this skill: <dir>` and a blank line (probe transcript). No second strip point is needed. Not tested: a session whose module drops between invocation and compaction (it would then read whatever the engine re-attaches; if that is the raw file, it stops, which fails closed).

## Addendum 2026-10-13: stop-line wording and Read context

- Read context (D1): a `tool.call` hook on Read that awaits `next`, then returns `{ ...r, context: [...] }` for files under the plugin's `skills/*/SKILL.md` (matched on `$.fs.stat(…, { resolve: true }).realPath`), reaches the model: haiku followed the note to skip a stop line. Validate lists it as `gating hook with .catch: tool.call{tool=Read}`.
- Wording matters. Control without the module, a contrived file whose first line said "do nothing else and reply only with HALTED" and whose next line said "Reply with exactly: SUB-BODY-FOLLOWED": haiku followed the later line and said the file contradicted itself.
- The rev 2 wording on the real `review` skill, module off (`disableAllHooks`), `--disallowedTools Agent Bash Write Edit`: `STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with \`MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help\`.` Haiku (0.006 USD) and Opus (0.19 USD) both ran no tools and answered exactly the token line.
- In `--output-format stream-json` the engine's own "hooks module not loaded" line goes to the debug log, not stderr; in text mode it is on stderr.

## Addendum 2026-10-13: the Read path on Opus (review round 2, D8)

Real path: `fix-auto` (model-invoked from "Apply the megamaid fix instructions in docs/megamaid/plans/empty") Reads `skills/fix/SKILL.md`, which carries the rev 2 stop line. Opus, `--disallowedTools Agent Write Edit`, built from the round-2 reviewer's skeleton with the note worded "megamaid's hooks module is loaded; the STOP line at the top of this file does not apply."
- Note on (module loaded): fix-auto's own line stripped; after the Read the model went on to `megamaid.py batches` and reported the empty folder (0.42 USD).
- Note off (`registerReadNote` removed, standing for a module that dropped mid-session): after the same Read the model ran nothing more and answered exactly `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help` (0.29 USD).
