# Live checks: recipes for paid runs

Nothing here is free. Run on the maintainer's go ([dev-flow](../process/dev-flow.md)); figures in [costs.md](costs.md). Last column as in [engine.md](engine.md).

## Engine question: a throwaway probe mod

A mod in the scratchpad with one `hooks.json`, one `register.ts` that logs what it sees, and a skill or two; run with `claude -p "/<mod>:<skill>" --plugin-dir <mod dir> --model haiku --debug-file <f>`, then read `<f>` and the session transcript. Not kept. Cost: see costs.md. (unverified)

## Run detection (review)

| Step | | Checked |
|---|---|---|
| Repo | A scratch git repo with one committed file and a one-line uncommitted change | unverified |
| Command | `claude -p "/megamaid:review" --plugin-dir <this repo> --debug-file <f>` | unverified |
| Pass | `<f>` has `[megamaid] run megamaid:review started (<id>)` and one `review/<role> spawned as <type> (<agentId>)` per reviewer; each agentId equals an `agentId` in an Agent tool result of the transcript `$CLAUDE_CONFIG_DIR/projects/<scratch path, slashes as dashes>/<session id>.jsonl` (default `~/.claude`) | code (lines); machine (transcript path) |
| Record | The local Claude Code version with the result | unverified |
| Cost | see costs.md | |

## Non-code plan (the dispatch site no eval reaches)

| Step | | Checked |
|---|---|---|
| Repo | A scratch repo with a non-code review report under `reviews/`, modelled on `scripts/fixtures/megamaid/project/reports/noncode-report.md` (`## Read`, `## Lens`, `## Findings` with flat labelled entries) | machine (fixture) |
| Command | `claude -p "/megamaid:plan reviews/<report>.md" --plugin-dir <this repo> --debug-file <f>` | unverified |
| Pass | Exactly one `revise-<stem>.md` in the plan output folder, in the revise-doc shape (header block, `## Notes for the implementer`); `<f>` has `plan/planner spawned as megamaid:planner` once | code (line) |
| Cost | see costs.md | |

## Eval suite

The command, its flags, the replay recipe and the per-case table: [evals/README.md](../../evals/README.md). Two notes for a local run: put Homebrew git first (`PATH=/opt/homebrew/bin:$PATH`; the sandbox cannot use Apple's shim) and pass `--keep-temp` so `/private/tmp/e-*` stays for replay; report both Claude Code versions (local and the vendored pin) when they differ.

| Situation | Rule | Checked |
|---|---|---|
| The module does not load in an eval run (every case fails `module-loaded`), or the runner or account fails | A runner or account failure (sandbox, out of credits, HTTP 429): report, do not debug ([dev-flow](../process/dev-flow.md)) | code (grader) |
| A case that passed before fails now | Read its kept trace (`/private/tmp/e-*`) before changing a grader or the plugin | unverified |
| A side agent claims something about the harness | Check it against a kept trace before acting (`tool_used` graders do see subagent calls: the trace carries `parent_tool_use_id`) | unverified |
