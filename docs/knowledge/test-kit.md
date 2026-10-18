# Test kit: `claude plugin test` as the module's tests use it

`claude plugin test .` runs every `*.test.ts` under the plugin (the module's are `hooks/*.test.ts`), each file in a child of the binary; `hooks/test-rig.ts` holds the shared setup. Last column as in [engine.md](engine.md).

| Fact | How the tests handle it | Checked |
|---|---|---|
| A relative `fs.write` or `fs.exists` path is resolved against the plugin folder (the test session's cwd) before a test hook sees it | `test-rig.ts` strips everything before `/.megamaid/`, so tests match the relative spelling | code |
| A backslash path is resolved the same way | The backslash-path test asserts by suffix (`endsWith('C:\\w\\reviews\\pr-3-round1-usage.md')`) | code |
| A test hook that throws is skipped | Answer `{ deny: '…' }` instead | unverified |
| A second `state.set` registration is refused | One `state.set` recorder per test, in `rig(on)` | unverified |
| Every test hook must be registered before the test's first `$` call | `rig(on)` and the `answer*` helpers come first in every test | code |
| A thrown plugin hook is printed only under a failing test ("the engine reported: hook failed closed …"); nothing in the test's `$` exposes it | The `.catch` handlers log `usage hook failed: <message>`, which a test reads from `rig.logs`; that is how a guard becomes assertable | code (log); unverified (kit output) |
| The test `$` has no `state` noun | Seed any run shape with `on('state.get', () => ({ value: { value: run, version: 1 } }))`; record writes with `on('state.set')` calling `next(e)` and keeping `e.value` when `r.value.isSet`, so `update`'s `ifVersion` retry works | code |
| Nothing answers `$.clock.now` unless `mock.clock(on, { now })` is used | `rig(on)` installs it; `{ clock: false }` withholds it | code |
| `setTimeout` is not in `lib` (`es2023` only) | Tests use `mock.clock` | code |
| A `ui.log` hook must answer `{ value: undefined }` | `rig` collects `e.text` into `logs` | code |
| `fs.stat` answers `{ value: { kind, size, mtimeMs, isLink, realPath } }`, `realPath` only under `resolve: true` | `answerStat(on)` maps spellings to real paths | code |
| A spawn fixture needs `parentModel`, `background`, `fork` | `spawnInput()` | code |
| `session.end` input needs `resume.id` | `endInput()` | code |
| `$.tool.call` passes `agentId` through at run time but `ToolCallArgs` omits it, so a literal argument fails tsc | A non-literal object: `const subagentRead = { tool: 'Read' as const, file_path, agentId: 'sub1' }` | code |
| `session.usage` and `turn.complete` need answers | `rig` answers both (`{ usage: false }` withholds the first); `rig.cost` sets `cost.usd`, `null` leaves cost out | code |
| A budget overrun cannot be simulated | The stripping `.catch` on `skill.prompt` is untested: removing it still passes every test | unverified |

How the gate runs the kit (fresh `CLAUDE_CONFIG_DIR`, `MIN_TESTS`, the refusal line in the output): [gates](../architecture/gates.md) §12.
