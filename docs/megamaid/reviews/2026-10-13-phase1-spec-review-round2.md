# Phase 1 spec review, round 2 (rev 2), consolidated

Spec: `docs/superpowers/specs/2026-10-13-megamaid-mod-skeleton-design.md` rev 2. Two lenses, Opus 5.5, no paid runs.
Contract (A): 1 C / 7 I / 13 M. Code and tests (B): 1 C / 3 I / 11 M. B built rev 2: spec-literal copy fails validate; a corrected skeleton passes validate, tsc and 18/18 tests with check-contract §11–12 at `scratchpad/review2-code/skeleton` (reuse in the plan).

## Critical

| ID | Finding | Fix |
|---|---|---|
| C1 (A-C1, B-C1) | `RUN` imported from `run.ts` fails validate: a state ref must be a literal const in the file that calls `$.state.*` or `update` with it. | Declare `RUN` in `skill-prompt.ts` and `agents.ts`; add the rule to "Engine rules"; a test asserts both consts are equal. |

## Important

| ID | Finding | Fix |
|---|---|---|
| I1 (A-I4, B-I1) | The brief's skill segment is dropped: plan writer, fix implementer and X-item planner all record `implementer`; palette and fix `code-reviewer` look alike. | `lane: string \| null` (brief skill) in `MegamaidAgent`; tests for the X-item planner path and palette vs fix reviewer. |
| I2 (A-I3) | The provider clause re-creates stale attribution (a later ad-hoc `megamaid:code-reviewer` is filed under the last run) and misses overridden scanner/shaver (no brief, foreign provider). | **Decision D7.** |
| I3 (A-I5, B-M1, B-M10) | Tracked types in `.claude-plugin/types/` are rewritten by the engine at every interactive `--plugin-dir` load, in every clone (README's install method) on any other version: dirty trees, pull conflicts, silent pin bumps. Every local Claude Code auto-update fails the local gate until types are regenerated. An engine-written 2.1.296 copy already exists (`~/.claude/dev-mods/…/skjar-next/.claude-plugin/types/`), so no interactive step is needed. | **Decision D6.** |
| I4 (A-I1, B-M9) | `SKIP_NOTE` fires on every Read of any `skills/*/SKILL.md` in any loop (help included; a reviewer auditing megamaid; the maintainer editing) and says "follow the rest". | Match the seven stop-line skills only; main loop only (`e.agentId === undefined`); word it as a fact: "megamaid's hooks module is loaded; the STOP line at the top of this file does not apply." Tests: help file and subagent Read get no note (with controls). |
| I5 (A-I2) | Module off, a stop line inside a Read result is untested with the rev 2 wording; the only Read-delivered test (weak wording, haiku) was ignored. Module on, the note was probed on haiku only. | **Decision D8** (probe). |
| I6 (A-I6, B-I2) | Smoke's module-on check (`/megamaid:help`) passes when the module failed to load: help has no stop line, and stderr is merged into stdout. | Help run captures stderr apart and fails on megamaid's not-loaded line; adds `--debug-file` and requires a module line (the `session.start`-free positive: run `/megamaid:help` is not a run, so use a debug line the module writes at `session.start`, e.g. `module loaded <version>`). |
| I7 (A-I7, B-M2) | The rig misses kit facts: `fs.stat` answer `{ value: { kind, size, mtimeMs, isLink, realPath } }`; a `tool.call {tool:'Read'}` answer; `state.set` recorder reads `r.value.isSet` and calls `next`; every test hook registered before the test's first `$` call; `$.plugin.root` is the root the Read hook resolves. | Spec the rig from B's skeleton. |
| I8 (B-I3) | `plugin test` summary parse: singular forms at 1, leading space on counts, `0 fail` substring matches ` 10 fail`. | Exit 0; `^Ran ([0-9]+) tests? across [0-9]+ files?\.` ≥ floor; `grep -qx ' 0 fail'` (B's §12). |

## Minor

| ID | Finding | Fix |
|---|---|---|
| M1 (A-M1, B-M1) | Version parsing: types line `// Written by Claude Code 2.1.296.` (trailing period); `claude --version` → `2.1.296 (Claude Code)`; tools file has no version line. | Name both regexes (`[0-9]+\.[0-9]+\.[0-9]+`); note tools churn. |
| M2 (B-M3, A-M3) | A stripping `.catch` keeps the strip when the hook throws after `next` and on budget overrun (`try` cannot); the `catch` log can itself throw; engine already prefixes log lines with the plugin name. | Keep `try`, add `.catch(async ($, e, next) => ({ text: stripStopLine((await next(e)).text) }))`; log with `.catch(() => {})`; drop the `megamaid:` self-prefix. Correct the "why one registration" wording. |
| M3 (A-M2, B-M4) | `session.end` is not a gating site; the `.catch` on observers only changes validate's wording and has no fail-first test. | Fix the sentences. |
| M4 (B-M5) | "A throw from `next` passes unstripped" cannot be tested in the kit. | Mark as engine behaviour (types doc), untested. |
| M5 (B-M6) | `skipLibCheck: true` hides errors in `types/index.d.ts`; validate misses them too. | `skipLibCheck: false` (0 errors on engine types, ~1 s). |
| M6 (A-M4, B-M7) | Smoke module-off: stderr needle unnamed; "token line" undefined; text mode cannot see tools (Read/Glob still allowed). | Export `TOKEN_LINE`; last non-blank stdout line, backticks trimmed, equals it; stderr needle `hooks module` + `not loaded`; accept Read/Glob or add a debug-file tool check. Installed-megamaid warning via `claude plugin list --json`. |
| M7 (A-M7, B-M8) | Brief regex: roles are arbitrary config keys; Windows `\`; `.gitattributes` covers `.md` only. | Role = text between `<skill>.` and `.brief.md`, no separators or whitespace; accept `\`; `*.ts text eol=lf`. |
| M8 (A-M8) | Read hook does two `stat`s on every Read. | Pre-filter on `SKILL.md` suffix and main loop before any `stat`. |
| M9 (A-M9) | "Denied or errored Read unchanged" lacks a positive control. | Add one. |
| M10 (A-M10) | Bound: bullets 1 and 3 read as contradictory; an old build may not load the plugin at all (no token); missing: another plugin's `skill.prompt` answering without `next` (false stop), a megamaid skill inside a subagent records no agents, a sub-skill read via `cat` (false stop). | Rewrite Bound. |
| M11 (A-M11) | `$.plugin.root` equal to `${CLAUDE_PLUGIN_ROOT}` for an installed (cache) copy unprobed. | Name the vacu-suck/fix-auto evals as evidence, or probe. |
| M12 (A-M12) | The CI dry run needs a push. | The plan asks for the go. |
| M13 (A-M5) | Docs: README:32 effort line, no tested version stated, eval negative graders pass vacuously when every case stops on the token (suite-wide `not_contains` grader, help-overview exempt), PLAYBOOK design rules (stop-line exception, pass-through `.catch` on observers), CHANGELOG lists the requirement under Changed (breaking for builds without mods). | Add. |
| M14 (A-M6) | Stop-line gate keyed to "the seven". | Every `skills/*/SKILL.md` except help. |
| M15 (A-M13, B-M10) | Tracked types ship to users (~800 KB); `claude-code-tools` is machine-specific but needed (`e.file_path` is `unknown` without it). | Follows D6. |
| M16 (B-M11) | `plugin test` refusals are intermittent locally; with a fresh `CLAUDE_CONFIG_DIR` it ran without auth. | Run the gate's `plugin test` under a fresh `CLAUDE_CONFIG_DIR`. |

## Decisions for the maintainer

- **D6** Where the pinned engine types live, and what a version mismatch does locally.
- **D7** How the briefless scanner/shaver are attributed.
- **D8** Probe the Read-path stop and note on Opus now (< 0.5 USD).
