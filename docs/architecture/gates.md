# Gates

## The release gate, in order

| Step | Command | Cost | Needs |
|---|---|---|---|
| 1 | `claude plugin validate .` | free | `claude` |
| 2 | `bash scripts/check-contract.sh` (§1 to §12 below; runs the script fixture tests, `tsc` and `claude plugin test`) | free; under a minute | `claude`, `node`, `npx`; network on the first `npx` run |
| 3 | the eval suite: command and flags in [evals/README.md](../../evals/README.md) | about 5 USD per single-run pass | an API key; on macOS a standalone git first on `PATH` |
| 4 | `bash scripts/smoke.sh`, once before a PR | about 0.25 USD | `claude` with an account |

Steps 1 and 2 run on every commit; when to pay for 3: [dev-flow.md](../process/dev-flow.md). Measured costs: [costs.md](../knowledge/costs.md).

## check-contract.sh

Exits non-zero on any `FAIL:` line; prints `check-contract: OK` otherwise. Runs from any directory.

| § | What it checks | Files it reads |
|---|---|---|
| 1 | No `spec §` or `decision §` citation in shipped files. | `skills/`, `agents/`, `shared/`, `directives/`, `README.md` |
| 2 | Every `${CLAUDE_PLUGIN_ROOT}/shared/*.md` reference names a file. | `skills/`, `agents/`, `README.md`; `shared/` |
| 3 | No shared block is re-inlined in a skill. The needle per block is its longest body line (intro before the first `## `, headings and table rows skipped) cut to 60 characters at a word boundary, and must be at least 30; one fixed needle guards removed wording. | `shared/*.md`, `skills/` |
| 4 | A skill that Reads another skill's `SKILL.md` carries the plugin-root expansion paragraph (Read output is not variable-substituted). | `skills/` |
| 5 | `manifest.py` and `megamaid.py` ship and `--help` exits 0; `test-manifest.sh`, `test-megamaid.sh`, `test-replay.sh`, `test-sync-types.sh` pass; `manifest.py` keeps `Excerpt grammar`; each skill invokes its subcommands (`excerpt` in review, plan, fix; `index anchors verify gate apply` in patterns; `config` in all seven; `brief` in review, plan, fix; `batches`, `report-name`, `findings`, `migrate config` where used; `shared/manifest-migration.md` carries `migrate manifest`); `REPORT_NAME` is one line in `ledger.ts`, uses no `\d` `\w` `\s`, matches `report-name` output for `--pr 7` and `--branch feat/x` and not `pr-7-round1-usage.md`; the three `.megamaid/.gitignore` writers write the one line `*`; every plan-lane `resolve`/`brief` carries `--role planner`; patterns and the scanner point at `scan-rules.md`; configure and patterns point at `manifest-migration.md`; the migration notice wording is shared with `migrate.py`; configure handles a failed migrate; `fix-reviewer-brief.md` keeps `git diff HEAD -- <files reported by implementer>`. | `scripts/*.py`, `scripts/test-*.sh`, `skills/*/SKILL.md`, `hooks/ledger.ts`, `hooks/usage.ts`, `shared/`, `agents/pattern-scanner.md` |
| 6 | The README Status line says `v<version>. See [CHANGELOG.md]` with the version from `plugin.json`. | `.claude-plugin/plugin.json`, `README.md` |
| 7 | No tracked `.DS_Store`. | `git ls-files` |
| 8 | Every `megamaid:*` `subagent_type` in defaults has an agent file; every agent's frontmatter `name` equals its filename and is a default somewhere; the fixture plugin's defaults equal the shipped file; planner and implementer carry exact `disallowedTools` lines and no `tools:` allowlist; the five reviewers carry `**Confidence**`; `dispatch-delivery.md` has no native allowlist. | `config/defaults.json`, `agents/*.md`, `scripts/fixtures/megamaid/plugin/config/defaults.json`, `shared/dispatch-delivery.md` |
| 9 | Every `(default: X)` in help equals defaults (effort lanes must read `unset`; `agents.<role>` compares the `subagent_type`; a placeholder key fails; zero matches fails). | `skills/help/SKILL.md` (or `$HELP_FILE`), `config/defaults.json` |
| 10 | Old-name guard: no identifier of the plugin this one was forked from in any tracked file's contents or path (whole word, `_`-joined and camelCase forms). Exempt: `CHANGELOG.md`, `scripts/migrate.py`, `scripts/fixtures/migrate/`, `vendor/claude-code-types/`, lines carrying the old repo URL. Fails closed outside a repo, on a `git grep` error or an unreadable file. Self-tests run in a scratch repo; `GUARD=off` skips the repo scan only. | `git ls-files`, `git grep` over the tracked tree |
| 11 | Exactly one `STOP_LINE` in `stop-line.ts`, holding no `"` or `\`; `STOP_SKILLS` equals the skills other than help; each carries the line exactly once, as the first non-blank line after the frontmatter; help never; every eval case with a `graders/` directory, `help-overview` excepted, has `graders/module-loaded.md` equal to the `last_message` `not_contains` grader for `STOP_TOKEN`. | `hooks/stop-line.ts`, `skills/*/SKILL.md`, `evals/*/graders/module-loaded.md` |
| 12 | `const RUN` is identical in, and only in, `agents.ts`, `session.ts`, `skill-prompt.ts`, `usage.ts`; the vendored types' version equals `claude --version` (WARN locally, FAIL under `CI`); `npx -p typescript@5.9.3 tsc -p .` passes; `claude plugin test .` in a fresh `CLAUDE_CONFIG_DIR` runs at least `MIN_TESTS=52` tests with `0 fail`. | `hooks/*.ts`, `vendor/claude-code-types/claude-code/index.d.ts`, `tsconfig.json`, `hooks/*.test.ts` |

## CI

`.github/workflows/ci.yml`, two jobs. Both install `@anthropic-ai/claude-code` at the version the vendored types' first line names.

| Job | When | Runs |
|---|---|---|
| `contract` | push to `main`, every pull request, `workflow_dispatch` | `claude plugin validate .` (no `--strict`), `bash scripts/check-contract.sh`; the log ends in `check-contract: OK`, no test count |
| `evals` | `workflow_dispatch` only | `claude plugin eval .` with `--max-cost-usd 20`, `--threshold 0.8`, `--model claude-opus-5-5 --judge-model claude-sonnet-5-5` (pinned so a model rollout is not read as a regression), `--json results.json` uploaded as an artifact |

Pushing a branch starts nothing; a draft PR gives a dry run. A dispatch also starts the paid job.

## smoke.sh

Runs validate and check-contract, warns when an installed `megamaid@…` is enabled (it can load ahead of `--plugin-dir .`), then three `claude -p` runs:

| Run | Flags | Pass when |
|---|---|---|
| `/megamaid:help` | `--plugin-dir .`, `--allowedTools "Skill Read"`, `--debug-file` | stderr has no "not loaded" for megamaid; the debug file has `[megamaid] module loaded (Claude Code …)`; the output has the overview heading and `STOP_TOKEN` in the Requirements block |
| `/megamaid:help fix` | same | the per-command detail prints |
| `/megamaid:review` | `--settings '{"disableAllHooks":true}'`, `--disallowedTools Agent Bash Write Edit`, `--max-turns 2` | stderr reports the module as not loaded (precondition) and the last non-blank line, backticks removed, equals `TOKEN_LINE` |

The eval suite is the behavioural gate; smoke proves the module loads and the stop line stops.

## The vendored types pin

`vendor/claude-code-types/claude-code/index.d.ts` is the engine's own types file, first line `// Written by Claude Code X.`; `sync-types.sh`, check-contract §12 and CI read X from that line alone, and `claude-code-tools/index.d.ts` (the build's tool inputs) is copied beside it. `tsconfig.json` builds `vendor`, `hooks` and `types` against them; CI installs that exact X. To refresh: run `claude --plugin-dir .` once interactively and exit (that lays `.claude-plugin/types/`, gitignored; how it is laid and why `claude -p` is not enough: [engine.md](../knowledge/engine.md)), then `bash scripts/sync-types.sh`, then commit on its own as `chore(types): Claude Code X`. The README's "tested on" line moves with it.

## Eval command

One source: [evals/README.md](../../evals/README.md) holds the command, its flags, the replay recipe for graders and the macOS git note. Experiments run the same runner with `--eval-dir experiments` ([experiments/README.md](../../experiments/README.md)).

## Accepted validate warning

`claude plugin validate .` warns about the repo's own root `CLAUDE.md` (the observation: [engine.md](../knowledge/engine.md)). Non-fatal without `--strict`; CI and smoke run without it. Accepted: the file is for sessions working on this repo, not for users of the plugin. Validate's advice about a marketplace install line in the README is informational.
