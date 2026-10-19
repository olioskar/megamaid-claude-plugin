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

## Baseline measurement: one full vacu-suck in a real project (MM-010)

The first live run of the plugin in an ordinary session. It yields the orchestrator's token share (the go/no-go for deterministic fix orchestration, MM-028) and confirms the two ledger bounds (MM-014, MM-015). Several USD.

| Step | | Checked |
|---|---|---|
| Repo | A real project of the maintainer's with a code-shaped branch: a few commits of real code against `main`, nothing uncommitted (`git status --porcelain` empty, or fix asks). Not this plugin ("never review the plugin with its own commands") | code (dev-flow) |
| Start | In that repo, interactive, from the main conversation, never from inside a subagent (MM-020): `claude --plugin-dir ~/Development/megamaid-claude-plugin --debug-file /tmp/megamaid-live.log`. On the API credits instead of the plan: prefix `ANTHROPIC_API_KEY=$(cat ~/keys/.anthropic-key)` | unverified |
| Loaded | `/megamaid:help` prints the overview, not `MEGAMAID-MODULE-NOT-LOADED`; the debug file has `[megamaid] module loaded (Claude Code 2.1.303 …)` | code (smoke) |
| Run | `/megamaid:vacu-suck` (scope: the branch, when asked). Answer only its questions; "run again?" with no | code (skill) |
| Read, right away | `<paths.reviews>/branch-<slug>-round1-usage.md` (default `docs/megamaid/reviews/`). Record: the `Orchestrator share` line, the `Cost` line, and the table whole | code (ledger) |
| Bounds | MM-014: every row's `Agents` equals the debug file's `spawned as` lines for that lane/role (nested spawns show as `nested spawn … under`). MM-015: no row with `Turns` below `Agents`. Owed rule: the orchestrator's `Turns` is the number of main-loop turns that dispatched or wrote the report, not the number of prompts typed | code (hooks) |
| Verdict | Orchestrator share of input tokens against the ideation estimate (20 to 35%); under 20% means only MM-028 is worth doing for tokens | code (MM-010) |
| Hand back | The ledger, the debug file and the per-item status list to a session, which records the figures in costs.md, settles MM-014 and MM-015 and MM-010 in issues.yaml, and files what broke | code (dev-flow) |

## Eval suite

The command, its flags, the replay recipe and the per-case table: [evals/README.md](../../evals/README.md). Two notes for a local run: put Homebrew git first (`PATH=/opt/homebrew/bin:$PATH`; the sandbox cannot use Apple's shim) and pass `--keep-temp` so `/private/tmp/e-*` stays for replay; report both Claude Code versions (local and the vendored pin) when they differ.

| Situation | Rule | Checked |
|---|---|---|
| The module does not load in an eval run (every case fails `module-loaded`), or the runner or account fails | A runner or account failure (sandbox, out of credits, HTTP 429): report, do not debug ([dev-flow](../process/dev-flow.md)) | code (grader) |
| A case that passed before fails now | Read its kept trace (`/private/tmp/e-*`) before changing a grader or the plugin | unverified |
| A side agent claims something about the harness | Check it against a kept trace before acting (`tool_used` graders do see subagent calls: the trace carries `parent_tool_use_id`) | unverified |
