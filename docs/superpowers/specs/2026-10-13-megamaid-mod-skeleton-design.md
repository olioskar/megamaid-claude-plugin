# Phase 1: mod skeleton — design

Date: 2026-10-13. Phase 1 of `docs/handover/plan.md`. Revision 3, after two two-lens review rounds (`docs/megamaid/reviews/2026-10-13-phase1-spec-review.md`, `…-round2.md`). Spike answers and follow-up probes: `2026-10-12-phase1-spike-findings.md` (beside this file). A skeleton that follows this design (rev 2 plus the round-2 Critical fix) passes validate, `tsc` and 18 tests: `scratchpad/review2-code/skeleton` in the design session; the plan reuses what it established.

## Goal

megamaid gains a hooks module that loads, is type-checked and tested in the free gates, and does two things. It fails every working skill closed when the module is not loaded. It detects megamaid runs and the agents they spawn, with each agent's role and lane. When the module is loaded, nothing a user sees changes. Run detection is the base for Phase 2 (usage per role) and Phase 3 (guards).

## Bound

The check stops a skill whose instructions the model reads while the module is absent. In detail:

- Covered, by the stop line in the skill text: a megamaid skill started by `/name`, the Skill tool, or a preload, in a session where the module never loaded on a mod-capable build: `disableAllHooks`, the rollout switch off, a `plugin.register` refusal, a load error in the module. Probed: `disableAllHooks` on review (haiku and Opus).
- Covered, by the missing Read note: a sub-skill file that vacu-suck or fix-auto Reads after the module dropped mid-session. Probed on Opus (fix-auto → fix).
- Not covered: a build without mods may refuse the plugin outright (its `hooks.json` holds only `modules`), so no skill loads and no token appears. Unprobed; the README states the requirement.
- Not covered: text the model already read. A module that drops after a skill's text was stripped leaves that text in force for the rest of the run, and Phase 3 guards are absent from then on. (A sub-skill Read after the drop is the covered case above.)
- Not covered: a megamaid agent spawned without a skill (by hand, by the model ad hoc, by another plugin). Agents carry no stop line. Phase 3 guards that act on agents state their own bound.
- False stops (fail closed, but wrong): another plugin's `skill.prompt` hook that answers without calling `next`, so ours never strips; a sub-skill file read through `cat` instead of Read; fix-auto or vacu-suck run inside a subagent (the skill's own line is stripped, since `skill.prompt` carries no `agentId`, but the sub-skill Read is a subagent's and gets no note). help names this case.
- Run detection gap: a megamaid skill run inside a subagent records no agents (only main-loop spawns are recorded), and it replaces the stored run, because `skill.prompt` carries no `agentId`: a main-loop run in progress then records its later spawns under the subagent's skill.

## Decisions

| Question | Decision |
|---|---|
| Spike order | Probes first (2026-10-12), then this spec. |
| Module not loaded | A stop line in each working skill, stripped by the module. No version check: no manifest field exists, and a version check misses the other causes. |
| Skills that carry the stop line | Every `skills/*/SKILL.md` except help. Today: review, plan, fix, fix-auto, vacu-suck, patterns, configure. |
| Stop line copied into each skill file | A deliberate exception to "a block shared across skills lives in `shared/`": the line must be in the file the engine loads. `hooks/stop-line.ts` is the single source, and a gate enforces the copies. |
| Sub-skill files Read by vacu-suck and fix-auto | A `tool.call` hook on Read adds a `context` note saying the stop line does not apply. No module, no note, so the stop stands (review round 1 D1; probed on Opus). |
| Agents a run records | Main-loop spawns that are megamaid's own dispatches: the prompt names a megamaid run brief; or, while the stored run is `megamaid:patterns`, the provider is megamaid (the briefless scanner and shaver). Role and lane come from the brief (round 1 D2, narrowed; round 2 D7). |
| Done-when evidence | Logged agentIds checked against the Agent tool results in the session transcript JSONL (round 1 D4). |
| Compaction | No second strip point: re-attached skill text after `/compact` is the stripped text (round 1 D5, probed). |
| Engine types for `tsc` | A pinned copy at `vendor/claude-code-types/` (`claude-code/index.d.ts`, `claude-code-tools/index.d.ts`), written by `scripts/sync-types.sh`. `.claude-plugin/types/` stays engine-owned and ignored (round 2 D6). |
| Claude Code version | The first line of `vendor/claude-code-types/claude-code/index.d.ts` is the single source. CI installs that version and fails on a mismatch; locally a mismatch warns with the refresh command (round 2 D6). |
| TypeScript | `typescript@5.9.3` through `npx`, pinned in `check-contract.sh` only. 5.4.5 rejects `target: es2023`. |
| Module file | `hooks/register.ts`, not `.tsx`: nothing draws until Phase 5. |
| Version | 0.2.0. Breaking for builds without mods. |

## Files

| Path | Purpose |
|---|---|
| `hooks/hooks.json` | `{ "modules": ["./register.ts"] }` |
| `hooks/register.ts` | `export const register: Register = on => { registerSkillPrompt(on); registerReadNote(on); registerAgents(on); registerSession(on) }` |
| `hooks/stop-line.ts` | `STOP_LINE`, `STOP_TOKEN`, `TOKEN_LINE`, `SKIP_NOTE`, `STOP_SKILLS` (the skill names that carry the line), pure `stripStopLine(text)`. |
| `hooks/skill-prompt.ts` | `registerSkillPrompt(on)`: the one `skill.prompt` registration (strip, then run start). Declares `RUN`. |
| `hooks/read-note.ts` | `registerReadNote(on)`: the Read context hook. |
| `hooks/agents.ts` | `registerAgents(on)`: `agent.spawn`. Declares `RUN`. |
| `hooks/session.ts` | `registerSession(on)`: `session.start` (a debug line naming the Claude Code version) and `session.end` (clears the run). Declares `RUN`. |
| `hooks/run.ts` | Pure helpers, no `$` and no state ref: `parseBrief(prompt)`, `startRun(…)`, `addAgent(run, …)`. |
| `hooks/test-rig.ts`, `hooks/*.test.ts` | Test setup and unit tests, `claude plugin test .`. |
| `types/index.d.ts` | The `$.state` contract, named in `plugin.json` as `"types"`. |
| `tsconfig.json` | See below. |
| `vendor/claude-code-types/` | Pinned engine types. |
| `scripts/sync-types.sh` | Copies the engine's types into `vendor/`. |
| `.gitattributes` | `*.md text eol=lf` and `*.ts text eol=lf`, so a Windows checkout cannot break the stop-line match or its extraction. |
| `.gitignore` | Gains `.claude-plugin/types/`. |

Engine rules the layout follows (found by validate during review):
- `$` is followed only into functions declared in the same file. Each `register*` function registers its hooks inline and receives `on`, never `$`.
- A state ref is a literal const in the file that passes it to `$.state.*` or `update`: `const RUN = { plugin: 'megamaid', key: 'run' } as const`, declared in each of `skill-prompt.ts`, `agents.ts`, `session.ts`. A test asserts the three are equal.
- An event registered more than once by the plugin needs a matcher on each registration; two matcherless registrations of one event are refused.
- Imports are extensionless (`from './stop-line'`); `.ts` fails `tsc` (TS5097).

`tsconfig.json`: the types header's configuration (`target`/`lib` es2023, `types: []`, `module` esnext, `moduleResolution` bundler, `strict`, `noUncheckedIndexedAccess`, `noEmit`, JSX factory `h`/`Fragment`) with `skipLibCheck: false` (true hid an error in `types/index.d.ts`; false adds no errors on the engine types and about a second); `include`: `vendor/claude-code-types`, `hooks`, `types`. With a root `tsconfig.json` present, the engine writes none of its own.

`scripts/sync-types.sh [<laid types folder>]`: copies `claude-code/index.d.ts` and `claude-code-tools/index.d.ts` from the given folder (default `.claude-plugin/types`, which an interactive `claude --plugin-dir .` lays) into `vendor/claude-code-types/`, and prints the version from the first line. Bootstrap source: an engine-written 2.1.296 copy already on this machine (`~/.claude/dev-mods/…/skjar-next/.claude-plugin/types/`). A refresh is its own commit: `chore(types): Claude Code X`. `claude-code-tools` is machine- and account-specific (it lists the tools that build registered) but is needed: without it `e.file_path` is `unknown`. A refresh can therefore change it for reasons other than the version.

## The stop line

`hooks/stop-line.ts` holds exactly one line of the form `export const STOP_LINE = "…"` (double quotes, no escapes):

```
STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`.
```

`STOP_TOKEN` = `MEGAMAID-MODULE-NOT-LOADED`; `TOKEN_LINE` = `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`. Tests assert `STOP_LINE` contains `` `TOKEN_LINE` ``. Probed: this wording stopped haiku and Opus on review (module off) and Opus on the fix-auto → fix Read path (note off). A weaker wording was ignored.

- Placement: the first non-blank line after the closing `---` of the frontmatter, in every skill but help.
- Strip: `registerSkillPrompt` registers `on('skill.prompt', { skill: /^megamaid:/ }, hook).catch(async ($, e, next) => ({ text: stripStopLine((await next(e)).text) }))`. The hook awaits `next(e)`, removes every line equal to `STOP_LINE` (the engine prefixes a "Base directory for this skill" line, so position is not used), then runs run start inside `try { … } catch { … }`, and returns the stripped text. The `.catch` replays `next` (nothing beneath runs twice) and strips, so a throw after `next` or a budget overrun still strips. A throw from `next` itself, or a `.catch` that throws, passes the text through unstripped (types doc for `skill.prompt`), and the model stops; the kit has no core beneath to test this.
- Why one registration: when either of two `skill.prompt` hooks of the plugin throws without a stripping `.catch`, the strip is lost (round 1, reproduced). One registration with `try` around run start, plus the stripping `.catch`, keeps run detection from ever causing a stop.
- Read note: `registerReadNote` registers `on('tool.call', { tool: 'Read' }, hook).catch(($, e, next) => next(e))`. The hook awaits `next(e)` and returns the result unchanged unless all hold, checked in this order: the call is in the main loop (`e.agentId === undefined`); the result is neither a deny nor an error; `e.file_path` ends in `/SKILL.md` (or `\SKILL.md`); its `$.fs.stat(…, { resolve: true }).realPath` is `<realPath of $.plugin.root>/skills/<name>/SKILL.md` with `<name>` in `STOP_SKILLS`. Then it returns the result with `SKIP_NOTE` appended to `context`. `SKIP_NOTE`: `megamaid's hooks module is loaded; the STOP line at the top of this file does not apply.` The hook refuses nothing; the `.catch` passes the call through, so a fault means no note, and the stop stands. That `$.plugin.root` equals the `${CLAUDE_PLUGIN_ROOT}` expansion for a marketplace-installed copy is unprobed; the vacu-suck and fix-auto eval cases show it for the eval's own load, and Phase 7 checks an installed copy.
- help: the Overview gains a **Requirements** block, right after the command list and before "Focus brief". It says megamaid needs a Claude Code build with hooks modules and the module loaded, and that `MEGAMAID-MODULE-NOT-LOADED` means it did not load. Causes, each with its remedy:
  - a build without mods: update Claude Code (such a build may refuse the plugin outright instead of showing the token);
  - `disableAllHooks` in settings: remove it or set it to false;
  - "hooks modules are turned off … rollout switch": start `claude` once with network access (seen to clear it in the spike; if it persists, mods are off for this account);
  - anything else: run `claude --debug-file <file>` and read the line naming megamaid, which gives the reason.

## Run detection

`types/index.d.ts` (no imports, no value exports):

```ts
export type MegamaidAgent = { subagentType: string; provider: string; role: string; lane: string | null; runStem: string | null }
export type MegamaidRun = { id: string; skill: string; startedAt: number; agents: Record<string, MegamaidAgent> }
declare module 'claude-code' {
  interface PluginState {
    megamaid: { run: MegamaidRun | null }
  }
}
```

Every write goes through `update($, RUN, fn)` from `claude-code` (written with `ifVersion`, retried on a miss), because review dispatches its reviewers in one message and their `agent.spawn` hooks run at once.

- Start: in the `skill.prompt` hook, for every megamaid skill but `megamaid:help`: a new run, `id` from `crypto.randomUUID()`, `skill` the qualified name, `startedAt` from `$.clock.now()`, `agents` empty. A later megamaid skill replaces it. A sub-skill that vacu-suck or fix-auto Reads raises no `skill.prompt`, so the run keeps the outer skill.
- Brief: `parseBrief(prompt)` finds `.megamaid/excerpts/<stem>.<lane>.<role>.brief.md` with `/` or `\` separators. `<stem>` matches `megamaid.py`'s `[a-z][a-z-]*-[0-9]+-[0-9a-f]{4}`; `<lane>` is `[a-z][a-z-]*` (the brief's skill: review, plan, fix); `<role>` is the text between `<lane>.` and `.brief.md` with no separator or whitespace (role names are config keys; `megamaid.py` does not restrict them).
- Agents: `registerAgents` registers `on('agent.spawn', hook).catch(($, e, next) => next(e))` (one matcherless registration). The hook awaits `next(e)`; it acts only when `e.parentAgentId === undefined` and the result has an `agentId`. It records the spawn when `parseBrief(e.prompt)` finds a brief, or when the stored run's `skill` is `megamaid:patterns` and `e.provider.plugin` before `@` is `megamaid`. The record: `subagentType`, `provider` (as given), `role` (from the brief; else `unknown`), `lane` (from the brief; else `null`), `runStem` (from the brief; else `null`). With no stored run it starts one with `skill: "none"`. Other spawns are ignored.
- Lane: one role name serves several jobs. The plan writer, the fix implementer and fix's X-item planner all brief as `implementer` (lanes plan, fix, plan with a fix stem); a palette `code-reviewer` and a fix reviewer `code-reviewer` differ by lane (review, fix). Phase 2 and Phase 3 key on (lane, role).
- Why narrowed: Phase 1 has no run end, so the stored run is the last run, not an active one. Recording every main-loop spawn, or every megamaid-provider spawn, would attribute an unrelated later spawn to it. The brief path marks megamaid's own dispatches whatever agent type a role is pointed at. The provider clause is held to patterns runs for the briefless scanner and shaver; an overridden scanner or shaver (a foreign type, no brief) goes unrecorded.
- End: `session.end` (`/clear` included) writes `null`.
- Log: `$.ui.log(text, { to: 'debug' })`, nothing in the transcript; the engine prefixes the plugin name, so the texts carry none. Lines: `module loaded (Claude Code <version>)` (from `session.start`, version from `$.session.version()`; `$.plugin` has only `name` and `root`), `run <skill> started (<id>)` and `<lane>/<role> spawned as <subagentType> (<agentId>)` (each after its state write), `run detection failed: <message>` (from the `try`). A log call inside the `catch` is written `.catch(() => {})` so it cannot throw.
- Failure: these hooks refuse nothing. `agent.spawn` is a gating site; its pass-through `.catch` only changes validate's report (a skipped observer leaves the spawn standing either way). `session.start` and `session.end` are not gating sites.
- Phase 3 note: a stored run means "the last run", not "a run in progress", and it may be a run a subagent started (see Bound).

## Tests

`hooks/test-rig.ts` gives every test the same setup (2.1.296 kit facts, established in review):
- every test hook is registered before the test's first `$` call;
- `mock.clock(on)`: nothing answers `$.clock.now` otherwise;
- an `on('ui.log', …)` hook answering `{ value: undefined }`, collecting lines;
- an `on('state.set', …)` recorder: the test's `$` has no `state`; the recorder calls `next(e)` (so `update`'s retry works), reads `r.value.isSet`, and keeps only writes that landed;
- an `on('fs.stat', …)` answerer returning `{ value: { kind, size, mtimeMs, isLink, realPath } }`, and an `on('tool.call', { tool: 'Read' }, …)` answer for Read tests; the kit's `$.plugin.root` is the plugin folder;
- typed fixtures for `agent.spawn` input (with `parentModel`, `background`, `fork`) and `session.end` input (with `resume.id`).
Tests use `mock.clock`, not `setTimeout` (not in `lib`).

Each test is written first and seen to fail. A negative test carries a positive control in the same body, so it fails while the hook is absent.

- Stop line: removed from a `megamaid:` skill wherever it stands; kept in another plugin's skill (control: the same text under `megamaid:` is stripped); text without it unchanged (control); a near-miss line kept (control); `STOP_LINE` contains `` `TOKEN_LINE` ``; the three `RUN` consts are equal.
- Isolation: when run start throws (no `mock.clock`), the line is still stripped and `run detection failed` is logged.
- Read note: a main-loop Read of `<root>/skills/review/SKILL.md` gains `SKIP_NOTE`; through a symlink spelling too; help's file, another file, and a subagent's Read (`agentId` set) gain none (each with the review-file control); a denied and an errored Read are returned unchanged (control).
- Run: a megamaid skill starts a run; `megamaid:help` does not replace it; a second skill replaces it; `session.end` writes `null`; `session.start` logs `module loaded`.
- Agents: a spawn with a brief is recorded with role, lane and stem; the X-item planner (fix stem, lane plan, role implementer) and a palette vs a fix `code-reviewer` record distinct lanes; a megamaid-provider spawn without a brief is recorded as `unknown` during a patterns run and ignored during a review run (control); a foreign-provider spawn without a brief is ignored (control); a subagent's spawn is ignored (control); a result without `agentId` records nothing (control); five spawns raised at once all land; a role with a dot or capitals parses; a `\`-separated brief path parses.

## Gates

`scripts/check-contract.sh`. Its header changes from "Deterministic and offline": it needs `claude` and `node` on PATH, and network on the first `npx` run, and fails with a clear message when either tool is missing.

- §4 (plugin-root paragraph for skills that Read another skill) is unchanged. The Read note is code, covered by plugin tests.
- §10 old-name guard: `vendor/claude-code-types/` joins `GUARD_EXEMPT` (engine text).
- New stop-line section: `STOP_LINE` is extracted from `hooks/stop-line.ts` (exactly one `export const STOP_LINE = "` line; the text contains no `"` or `\`; else fail). Every `skills/*/SKILL.md` except help carries it exactly once (`grep -cxF`), as the first non-blank line after the frontmatter; help does not carry it; the skill names equal `STOP_SKILLS` in `stop-line.ts`. Written to fail first.
- New engine section:
  - Version: `sed -n '1s/^\/\/ Written by Claude Code \([0-9][0-9.]*[0-9]\)\.$/\1/p'` on `vendor/claude-code-types/claude-code/index.d.ts`, and `sed -n '1s/^\([0-9][0-9.]*[0-9]\) (Claude Code)$/\1/p'` on `claude --version`. Unequal: fail when `CI` is set; otherwise print both versions and the refresh steps (`claude --plugin-dir .` once, then `scripts/sync-types.sh`, then commit) and continue.
  - `npx -y -p typescript@5.9.3 tsc -p .` exits 0.
  - `claude plugin test .`, run with `CLAUDE_CONFIG_DIR` set to a fresh temp directory (a saved rollout switch then cannot block it; it ran without auth there in review): exit 0; `sed -nE 's/^Ran ([0-9]+) tests? across [0-9]+ files?\..*/\1/p'` at or above the floor set in this section; `grep -qx ' 0 fail'`. A `claude plugin test:` refusal line fails with its text.
- CI (`ci.yml`): both jobs install `@anthropic-ai/claude-code@<version>` with `<version>` read from the vendored types by the same `sed`; Node is on `ubuntu-latest`. The first plan task pushes a branch for a CI dry run of the new gate, on the maintainer's go. If `claude plugin test` refuses there, the task stops and reports; the maintainer decides.
- PLAYBOOK release gate: step 3 becomes "covered by step 2 (`check-contract.sh` runs `tsc` and `claude plugin test`)".

`scripts/smoke.sh`:
- Warns when `claude plugin list --json` shows an enabled plugin whose `id` starts `megamaid@`, which can load ahead of `--plugin-dir .`.
- Module-on: the existing `/megamaid:help` runs gain `--debug-file <tmp>`, with stdout and stderr captured apart. Fail when stderr carries a line with both `megamaid` and `not loaded`, or when the debug file lacks `module loaded`. The overview checks stay on stdout.
- Module-off: `claude -p "/megamaid:review" --plugin-dir . --settings '{"disableAllHooks":true}' --disallowedTools Agent Bash Write Edit --max-turns 2 < /dev/null`, text output, stdout and stderr apart. Pass when stderr has a line with both `megamaid` and `not loaded` (the precondition) and stdout's last non-blank line, backticks trimmed, equals `TOKEN_LINE` read from `hooks/stop-line.ts`. Read and Glob stay allowed (text mode cannot see tool calls; the probes saw none). About 0.20 USD on Opus; a turn cap, not a dollar cap, because one turn on Fable 5.1 with a large global context already costs about 0.3 USD.

## Evals

- One new grader in every case but `help-overview`: `regex`, `last_message`, `not_contains` `MEGAMAID-MODULE-NOT-LOADED`. Without it, cases whose graders are negative (no edits, no plan files, max 0) pass when the module failed to load. help is exempt because its Requirements block names the token.
- Full suite once before the PR (about 5 USD). Baseline: comb v0.15.0, `~/Development/comb-the-desert-claude-skill/evals/results/2026-10-12T01-29-43-961Z` (6/8, 4.64 USD), its two misses re-read through the fixed graders (`scripts/replay-graders.py`) so the comparison is like for like. A case that passed there and fails here is read from its kept trace before anything changes. If the module does not load in the eval run, the new grader fails every case: that is reported, not fixed in the runner.
- Evals and live checks run on the local Claude Code, which can differ from the CI pin; the report states both versions.

## Live check

One real `/megamaid:review` on a small diff in a scratch repo, `claude -p --plugin-dir <repo> --debug-file <f>`, about 0.5–1 USD (said before the run). Pass: the debug file has `run megamaid:review started` and one `review/<role> spawned` line per reviewer, and each logged agentId equals an `agentId` in the session transcript JSONL's Agent tool results.

## Docs and release

- CHANGELOG `## [0.2.0]`: Added — the hooks module; the stop line in every working skill, so a session without the module stops instead of running unguarded; run detection with role and lane. Changed — megamaid now requires a Claude Code build with hooks modules (breaking for builds without mods); help gains Requirements.
- README:
  - line 7: megamaid requires a mod-capable Claude Code with the module loaded;
  - `## Requirements`: add the hooks-module requirement, the tested version (from the vendored types), and what the token means; line 32's effort note stays but reads as an extra condition;
  - Development: the gate list (`tsc`, `plugin test` in check-contract), the types refresh, smoke's checks.
- `smoke.sh` line 2 and the PLAYBOOK smoke sentence: module-on and module-off checks, cost.
- evals/README: smoke is not offline (it calls `claude -p`); the not-loaded grader.
- PLAYBOOK:
  - "Where things live": `hooks/` layout, `hooks/stop-line.ts` as the stop line's single source, `vendor/claude-code-types/` and `scripts/sync-types.sh`;
  - "Design rules": the stop line as the stated exception to "Single source"; observer hooks at gating sites take a pass-through `.catch` (they refuse nothing), which validate still lists as gating;
  - "Release gate": step 3 as above.
- `version` 0.2.0 in `plugin.json` and the README Status line, together.
- `docs/handover/plan.md`: Phase 1's text (`register.ts`; a module that strips and detects, not a no-op), spike questions answered with a link; Phase 2: a background agent's completion raises an extra main-loop `turn.complete`, run end must be defined, usage keys on (lane, role); Phase 4: the fix gate is feasible (a hook can deny the Skill tool call once `fix` drops `disable-model-invocation`).

## Done when

- The free gates pass with `tsc` and `claude plugin test` in them, locally and in CI.
- `smoke.sh` passes, module-on and module-off checks included.
- One real `/megamaid:review` shows run detection in the debug log, its agentIds matching the transcript.
- The full eval suite has run once with the not-loaded grader and is compared with comb v0.15.0.
