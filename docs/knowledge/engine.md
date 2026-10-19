# Engine: Claude Code's validator, types and hooks runtime

Checked against the vendored 2.1.303 types and `claude` 2.1.303 with this plugin's module ([hooks-module](../architecture/hooks-module.md), events in [hook-events](../api/hook-events.md)). The last column says how a row is known: `code` (the working tree relies on it), `machine` (checked on this machine), `unverified` (stated in a working note only).

## `claude plugin validate`

| Rule | Consequence for the module | Checked |
|---|---|---|
| `$` is followed only into functions declared in the same file | A helper that takes `$` lives in the file that registers the hook; validate prints it as `$.fs.write (via writeLedger)` | machine |
| A state ref must be a literal const in the file that passes it to `$.state.*` or `update` | The `RUN` copies ([hooks-module](../architecture/hooks-module.md), State) | code |
| Two matcherless registrations of one event are refused | One `skill.prompt`, one `turn.complete`, one `agent.spawn` registration | code |
| `$.ui.log?.()` is rejected: "`$.ui.log` is used as a value (an event of `$` bound, passed or read) instead of called; `$` is always spelled `$.noun.event(...)` at the call site" | `$` events are called directly | machine |
| Gating hooks are listed as `gating hook with .catch: tool.call{tool=Read}`, `agent.spawn`, `tool.call{tool=Write}`; `turn.complete` is listed as a plain hook | An observer's pass-through `.catch` changes validate's wording only | machine |
| Any text passes in an agent's `disallowedTools`; eval cases are not validated (a misspelled grader key passes) | check-contract §8 pins the frontmatter lines; replay fixtures pin the graders | machine |
| A `CLAUDE.md` at the plugin root warns: not loaded as project context, use a skill instead | The repo's own `CLAUDE.md` draws it; accepted ([gates](../architecture/gates.md)) | machine |
| `skill.prompt` hooks do not run for a user-installed plugin where an organization manages Claude Code | Printed as a note on every validate | machine |
| Advice: the README has no marketplace install line | Advice only; it does not change the verdict | machine |

## Types

| Fact | Consequence | Checked |
|---|---|---|
| The engine's hooks types live inside the native binary, a bundled skill extracted to `/private/tmp/claude-<uid>/bundled-skills/<version>/<hash>/plugin-authoring/types/claude-code.d.ts` (one file of about 22k lines, first line `// Written by Claude Code <version>.`); the npm package is platform binaries only | `tsc` in CI needs the committed copy under `vendor/claude-code-types/`; `sync-types.sh` reads the `claude-code/index.d.ts` layout, so it cannot consume the extracted file as is | machine (path); unverified (npm) |
| `.claude-plugin/types/` is laid only by an interactive `claude --plugin-dir .` session and rewritten on every load; `claude -p`, CI and `claude plugin test` lay none | The `expect` recipe ([tooling](tooling.md)) | unverified |
| `claude-code-tools/index.d.ts` lists the tools the build registered, so it is machine- and account-specific; without it `e.file_path` is `unknown` | A types refresh can change it for reasons other than the version | unverified |
| The engine writes `.claude-plugin/types/.gitignore` holding `*` | The folder is ignored twice over (the root `.gitignore` lists it too); nothing under it is in tsconfig `include` | machine |
| A root `tsconfig.json` is left alone; the engine still writes `.claude-plugin/types/tsconfig.json` of its own (`skipLibCheck: true`, `include` `../../hooks`, `../../types`, `../../tests`) | `tsc -p .` reads the root one | machine |
| TypeScript 5.9.3 is pinned, in `check-contract.sh` only (`npx -y -p typescript@5.9.3 tsc -p .`); 5.4.5 rejects `target: es2023` | No package.json | code (pin); unverified (5.4.5) |
| Imports between hook files are extensionless; `.ts` fails tsc (TS5097) | `from './stop-line'` | code |
| `skipLibCheck: false` on purpose: `true` would hide an error in `types/index.d.ts` that validate also misses; `false` adds no errors on the engine types and about a second | tsconfig.json | code |
| The first line of `vendor/claude-code-types/claude-code/index.d.ts` names the version (`// Written by Claude Code 2.1.303.`); CI installs that version and fails on a mismatch, locally a mismatch warns | check-contract §12, ci.yml | code |

## Runtime

| Fact | Consequence | Checked |
|---|---|---|
| `$.state.set(ref, undefined)` is refused at run time ("value is not JSON data") though tsc accepts it | A cleared run is `null` (`session.ts`) | code (null); unverified (message) |
| `$.ui.log` defaults to the transcript; `{ to: 'debug' }` keeps a line out of what the user sees; the engine adds the `[<plugin>]` prefix; the call returns `void` | Texts carry no prefix; a log call cannot reject | code |
| Skill text reaches the model prefixed `Base directory for this skill: <dir>` and a blank line | The stop line is removed by content wherever it stands (`stripStopLine`), not by position | code (strip); unverified (prefix) |
| After `/compact` the re-attached skill text is the stripped text | No second strip point | unverified |
| A `tool.call` Read hook that awaits `next` and returns `{ ...r, context: [...] }` reaches the model; haiku and Opus follow such a note past a stop line | `read-note.ts` | unverified |
| `skill.prompt` fires for a `disable-model-invocation` skill (plugin-qualified name); a slash invocation raises no `tool.call`; a model's Skill tool call raises `tool.call { tool: "Skill", skill }` and `{ deny }` refuses it | A skill can drop `disable-model-invocation` and be gated by a hook instead | unverified |
| `$.process.run` runs `python3` and `git` from a hook, cwd = session cwd | | unverified |
| `$.session.version()` answers `{ version, base, builtAt }`; no minimum-version field exists in the manifest or types | The load line logs `version` | code |
| `agent.spawn`'s `provider.plugin` reads `<plugin>@<source>` (`megamaid@inline`) | `agents.ts` compares the part before `@` | code |
| `agent.spawn`'s result carries `agentId`; the subagent's tool calls and `turn.complete` carry the same id | Usage is attributed by `e.agentId` | code |
| A background subagent's completion starts another main-loop turn: one prompt can raise several main-loop `turn.complete`s | Usage is summed per run, never per turn | unverified |
| `claude plugin eval` loads the hooks module inside the run; an absolute `$.fs.write` from the module escapes the eval sandbox | The ledger writes relative paths | unverified |
| The engine's "hooks module not loaded" line is on stderr in text mode and in the debug log under `--output-format stream-json` | smoke reads stderr in text mode | code (text); unverified (stream-json) |
| `claude plugin list --json` returns a top-level array of `{ id, version, scope, enabled, installPath, installedAt, lastUpdated, projectEnabled }`, plus `projectPath` on `scope: project` rows | smoke warns when an enabled `megamaid@…` entry exists: it can load ahead of `--plugin-dir .` | machine |
| `claude plugin test` needs a fresh `CLAUDE_CONFIG_DIR` (it then runs without auth) and refuses while a rollout switch is saved off; refusals are intermittent | check-contract §12 sets a temp dir and fails on a `claude plugin test:` refusal line | code (config dir); unverified (refusal) |
| `disableAllHooks: true` in settings, or the saved-off rollout switch, skips the module while the skills still run; in `-p` one stderr line says so and nothing tells the model | The stop line in every working skill ([design-rules](../architecture/design-rules.md)) | code |
| `claude config get model` runs as a prompt and costs money | Read the model elsewhere | unverified |
| Stop wording: a contrived "do nothing else" first line is ignored by haiku when a later line contradicts it; the shipped `STOP. … reply only with …` line stops haiku and Opus with exactly the token line, module off | `hooks/stop-line.ts`; smoke's module-off run checks it | code (smoke); unverified (probe) |
