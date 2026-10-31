# megamaid

A Claude Code plugin for code review. `/megamaid:review` finds issues, `/megamaid:plan` turns each one into a fix instruction, `/megamaid:fix` applies them, and `/megamaid:vacu-suck` runs all three in one go.

Reviewers follow eight shipped directives plus your own, and a layered config lets each project override the defaults.

Forked from [comb](https://github.com/olioskar/comb-the-desert-claude-plugin). megamaid adds a hooks module (a load guard, call-time guards on its own agents, the configured model set at spawn, and a usage ledger) and requires a Claude Code build with hooks modules, with the module loaded; comb stays for builds without them.

With [comb](https://github.com/olioskar/comb-the-desert-claude-plugin) also installed, both plugins' model-invocable skills trigger on the same phrases; install one, or use explicit `/megamaid:*` commands.

## Commands

- **`/megamaid:review`** runs 1–5 reviewer agents over a PR, branch, file list, or spec. A code change gets a severity-ranked report with a verdict. A prose change (spec, design doc) gets a shorter report with labelled findings.
- **`/megamaid:plan`** writes one self-contained fix instruction per finding; for a prose report, one `revise-<spec>.md`.
- **`/megamaid:fix`** applies the instructions: an implementer and a reviewer per item, items that touch different files in parallel, one commit per passing item. Only you can start it; see "Let Claude start fixes" below to change that.
- **`/megamaid:vacu-suck`** runs review, plan, and fix without pauses. On a prose change it stops after review.
- **`/megamaid:patterns`** scans the codebase and writes a PATTERNS manifest: the project's actual conventions, with `file:line` references. Review, plan, and fix give agents the relevant excerpt as a baseline. `--shave` shrinks an existing manifest without changing what it says.
- **`/megamaid:configure`** changes the config from a plain-language request.
- **`/megamaid:help`** prints an overview. `/megamaid:help <command>` shows one command in detail.

Review, plan, fix, vacu-suck, and patterns take a free-form focus brief that steers which agents run (review and vacu-suck) and what every dispatched agent prioritizes:

```
/megamaid:review look for spec/plan misalignment
/megamaid:vacu-suck ensure simplicity, scope discipline, and TDD coverage
```

## Requirements

- Claude Code with hooks modules (tested on 2.1.303, the version in `vendor/claude-code-types/`), with megamaid's hooks module loaded. A command that replies `MEGAMAID-MODULE-NOT-LOADED` means it did not load; `/megamaid:help` lists the causes.
- `python3`; the scripts are stdlib-only. Every command but help starts by running one and stops if it can't.
- `git`. `gh` is also needed to review a PR by number.

## Install

```bash
claude --plugin-dir /path/to/megamaid-claude-plugin
```

### Migrating

Coming from [comb](https://github.com/olioskar/comb-the-desert-claude-plugin)? Before your first megamaid run, and only while `docs/megamaid/` does not exist yet, move comb's output folder with `git mv docs/combs docs/megamaid` (plain `mv` if it is untracked); this also puts the PATTERNS manifest where megamaid reads it. Then run `/megamaid:configure` to migrate comb's config, and point any `paths.*` it copied from `docs/combs/` at `docs/megamaid/`. If you don't move the folder, `/megamaid:configure` offers to move or copy the manifest instead. An empty `{}` `megamaid.config.json` silences the config notice.

## Quick start

In a git repo with changes on a branch, run `/megamaid:review`. The report lands in `docs/megamaid/reviews/`, with the run's token ledger (`…-usage.md`) beside it ([docs/features/usage-ledger.md](docs/features/usage-ledger.md)). Run `/megamaid:plan` on it, then `/megamaid:fix`. Or run `/megamaid:vacu-suck` to do all three.

## Configuration

Three layers are deep-merged, later layers winning: `config/defaults.json` in the plugin, then `~/.claude/megamaid.config.json` (global), then `<project-root>/.claude/megamaid.config.json` (project).

`/megamaid:configure` makes changes for you, for example "disable test-auditor" or "use sonnet for the fix implementer". It shows a diff and, after you confirm, writes the change to the global or project file.

`config/defaults.json` lists every key with its default. Three kinds of setting are absent by default: `effort.<lane>`, and the per-role `agents.<role>.model` and `agents.<role>.effort`. Every key: [docs/api/config.md](docs/api/config.md).

### Models and effort

```json
{ "models": { "fix": { "implementer_standard": "sonnet" } },
  "effort": { "review": "medium" },
  "agents": { "simplifier": { "model": "haiku" } } }
```

- **Models** can be `sonnet`, `opus`, `haiku`, or `fable`. Use an alias: patterns' scanner and shaver pass the model on the Agent call, which rejects a full model ID.
- **Where to save:** the planner is the senior of the pair. A good instruction lets a cheaper implementer apply it, so lower `models.fix.implementer_standard` or `models.fix.implementer_trivial` and keep `models.plan` strong.
- **Effort** can be `low`, `medium`, `high`, `xhigh`, or `max`. When it is unset, agents use your session's effort. On one fixture ([experiments/README.md](experiments/README.md)) `medium` matched `high` for about 8% less.
- **Per-role settings** beat the lane setting.

### Turn off per-item commits

`{ "fix": { "commit_per_item": false } }`

### Let Claude start fixes

`{ "fix": { "model_invocation": true } }`

`/megamaid:fix` is user-only by default because it edits code and commits. With this flag, asking in your own words ("apply the fixes") runs the same workflow, with the same questions and commits. Without the flag, such a request gets a short reply naming `/megamaid:fix` and the flag.

### Use your own writer or planner

`{ "agents": { "implementer": { "subagent_type": "your-org:implementer" }, "planner": { "subagent_type": "your-org:planner" } } }`

The default writer, `megamaid:implementer`, edits only the files the instruction names, never commits, and reports every file it touched. The default planner, `megamaid:planner`, writes one instruction file per finding and never edits source. A writer or planner from outside this plugin gets an explicit instruction that the directives are authoritative, the same boundaries, and the same checks after it returns.

### Add or swap reviewers

```json
{ "agents": { "react-expert": { "subagent_type": "react-expert", "when_to_use": "Diff includes React components, hooks, or JSX." },
              "simplifier": { "subagent_type": "pr-review-toolkit:code-simplifier" },
              "test-auditor": null } }
```

A new role needs `subagent_type` and `when_to_use`. Overriding a shipped role can set just the fields you change. `null` removes a role.

### Use your own directives

`{ "directives": { "user_path": "docs/our-rules" } }`

## Directives

The plugin ships eight directives in `directives/`:

| File | Rule |
|---|---|
| `simplicity.md` | no overengineering or speculative fixes |
| `modularity.md` | single responsibility, clear interfaces |
| `reusability.md` | no copy-paste, no premature abstraction |
| `maintainability.md` | naming, comments, no dead code |
| `quality.md` | correctness, error handling |
| `consistency.md` | follow existing patterns and the spec |
| `scope-discipline.md` | stay inside the requested change |
| `testing.md` | real tests that cover changed behavior |

Your directives in `directives.user_path` (default `docs/directives/`) apply on top. Both sets are authoritative, and findings cite them as `<file>.md §N.N`. Agents get the files by path, not pasted into their prompt. To use only your own directives, set `"directives": { "include_plugin_defaults": false }`.

## Agents

| Agent | Role |
|---|---|
| `megamaid:code-reviewer` | bugs, logic, contracts, security |
| `megamaid:simplifier` | overengineering, dead code, duplication |
| `megamaid:silent-failure-hunter` | swallowed errors, hidden fallbacks |
| `megamaid:test-auditor` | coverage and test quality |
| `megamaid:consistency-auditor` | fit with existing patterns and with the spec or plan |
| `megamaid:planner` | writes the instructions for `/megamaid:plan` and for the issues `/megamaid:fix` discovers |
| `megamaid:implementer` | the writer for `/megamaid:fix` |
| `megamaid:pattern-scanner` | used only by `/megamaid:patterns` |
| `megamaid:pattern-shaver` | used only by `/megamaid:patterns --shave` |

The five reviewers are read-only: Write, Edit, and NotebookEdit are withheld in their agent files; Bash stays for git. A clean diff should come back with few or no findings. `simplifier`, `silent-failure-hunter`, and `consistency-auditor` re-check their findings in a final step; `code-reviewer` and `test-auditor` have no such step.

Before a finding enters the report, `/megamaid:review` opens every cited line and recomputes every count. Each finding carries a `Verified:` line stating what was checked and what was not. `/megamaid:plan` re-checks anything marked unchecked.

## How it works

The skills in `skills/` are the contract; bundled stdlib scripts do the bookkeeping (config merge, model resolution, directive matching, report naming, batching), and a hooks module gates the commands, refuses a megamaid agent's out-of-bounds call, sets each briefed agent's model from config, and writes a usage ledger per run. Per-command behavior is in [docs/features/](docs/features/INDEX.md); the design is in [docs/architecture/overview.md](docs/architecture/overview.md).

## Development

The process is in [docs/process/dev-flow.md](docs/process/dev-flow.md). Two free gates, `claude plugin validate .` and `bash scripts/check-contract.sh`, run on every commit and in CI (pushes to `main`, every pull request, manual dispatch). The remaining gates are in [docs/architecture/gates.md](docs/architecture/gates.md); the eval suite (nine behavioral cases, about 5 USD per pass, manual dispatch in CI) in [evals/README.md](evals/README.md). Docs: [docs/INDEX.md](docs/INDEX.md) lists every reference set.

## Status

v0.6.0. See [CHANGELOG.md](CHANGELOG.md); earlier history is linked from its 0.1.0 entry.

## License

MIT
