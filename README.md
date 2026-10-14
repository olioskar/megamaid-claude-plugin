# megamaid

A Claude Code plugin for code review. `/megamaid:review` finds issues, `/megamaid:plan` turns each one into a fix instruction, `/megamaid:fix` applies them, and `/megamaid:vacu-suck` runs all three in one go.

Reviewers follow eight shipped directives plus your own, and a layered config lets each project override the defaults.

Forked from [comb](https://github.com/olioskar/comb-the-desert-claude-plugin) 0.15.3. megamaid moves comb's rules into a hooks module and requires a Claude Code build with hooks modules, with the module loaded; comb stays for builds without them.

With [comb](https://github.com/olioskar/comb-the-desert-claude-plugin) also installed, both plugins' model-invocable skills trigger on the same phrases; install one, or use explicit `/megamaid:*` commands.

## Commands

- **`/megamaid:review`** runs 1–5 reviewer agents over a PR, branch, file list, or spec. A code change gets a severity-ranked report with a verdict. A prose change (spec, design doc) gets a shorter report with labelled findings.
- **`/megamaid:plan`** writes one self-contained fix instruction per finding.
- **`/megamaid:fix`** applies the instructions. Each item gets an implementer and a reviewer, and items that touch different files run in parallel. Before each commit, the reviewer runs the plan's `Check:` line and the project's tests run. A failed attempt is reverted and recorded before the retry. Each passing item is committed as `<code>: <title>`. Only you can start it; see "Let Claude start fixes" below to change that.
- **`/megamaid:vacu-suck`** runs review, plan, and fix without pauses. On a prose change it stops after review.
- **`/megamaid:patterns`** scans the codebase and writes a PATTERNS manifest: the project's actual conventions, with `file:line` references. Review, plan, and fix give agents the relevant excerpt as a baseline. `--shave` shrinks an existing manifest without changing what it says.
- **`/megamaid:configure`** changes the config from a plain-language request.
- **`/megamaid:help`** prints an overview. `/megamaid:help <command>` shows one command in detail.

Every command takes a free-form focus brief that steers which agents run and what they prioritize:

```
/megamaid:review look for spec/plan misalignment
/megamaid:vacu-suck ensure simplicity, scope discipline, and TDD coverage
```

## Requirements

- Claude Code with hooks modules (tested on 2.1.299, the version in `vendor/claude-code-types/`), with megamaid's hooks module loaded. A command that replies `MEGAMAID-MODULE-NOT-LOADED` means it did not load; `/megamaid:help` lists the causes.
- `python3` 3.8 or later. Every command starts by running a bundled stdlib script and stops if it can't.
- `git`. `gh` is also needed to review a PR by number.
- Claude Code 2.1.292 or later, only if you configure an `effort` value.

## Install

```bash
claude --plugin-dir /path/to/megamaid-claude-plugin
```

Coming from [comb](https://github.com/olioskar/comb-the-desert-claude-plugin)? Before your first megamaid run, and only while `docs/megamaid/` does not exist yet, move comb's output folder with `git mv docs/combs docs/megamaid` (plain `mv` if it is untracked); this also puts the PATTERNS manifest where megamaid reads it. Then run `/megamaid:configure` to migrate comb's config, and point any `paths.*` it copied from `docs/combs/` at `docs/megamaid/`. If you don't move the folder, `/megamaid:configure` offers to move or copy the manifest instead. An empty `{}` `megamaid.config.json` silences the config notice.

## Quick start

In a git repo with changes on a branch:

```
/megamaid:review
```

The report lands in `docs/megamaid/reviews/`. Run `/megamaid:plan` on it, then `/megamaid:fix`. Or run `/megamaid:vacu-suck` to do all three.

## Configuration

Three layers are deep-merged, with later layers winning:

1. `config/defaults.json` in the plugin
2. `~/.claude/megamaid.config.json` (global)
3. `<project-root>/.claude/megamaid.config.json` (project)

`/megamaid:configure` makes changes for you, for example "disable test-auditor" or "use sonnet for the fix implementer". It shows a diff, then writes the change to the global or project file.

`config/defaults.json` lists every key with its default. Three kinds of setting are absent by default: `effort.<lane>`, and the per-role `agents.<role>.model` and `agents.<role>.effort`.

### Models and effort

```json
{
  "models": { "fix": { "implementer_standard": "sonnet" } },
  "effort": { "review": "medium" },
  "agents": { "simplifier": { "model": "haiku" } }
}
```

- **Models** can be `sonnet`, `opus`, `haiku`, or `fable`. The agent dispatch rejects a full model ID.
- **Where to save:** the planner is the senior of the pair. A good instruction lets a cheaper implementer apply it, so lower `models.fix.implementer_standard` or `models.fix.implementer_trivial` and keep `models.plan` strong.
- **Effort** can be `low`, `medium`, `high`, `xhigh`, or `max`. When it is unset, agents use your session's effort.
- **Per-role settings** beat the lane setting.

In one measured review run, `medium` found the same bugs as `high` for about 8% less.

### Turn off per-item commits

```json
{ "fix": { "commit_per_item": false } }
```

### Let Claude start fixes

```json
{ "fix": { "model_invocation": true } }
```

`/megamaid:fix` is user-only by default because it edits code and commits. With this flag, asking in your own words ("apply the fixes") runs the same workflow, with the same questions and commits. Without the flag, such a request gets a short reply naming `/megamaid:fix` and the flag.

### Use your own writer or planner

```json
{ "agents": { "implementer": { "subagent_type": "your-org:implementer" },
              "planner": { "subagent_type": "your-org:planner" } } }
```

The default writer, `megamaid:implementer`, edits only the files the instruction names, never commits, and reports every file it touched. A writer from outside this plugin gets an explicit instruction that the directives are authoritative. It also gets the same boundaries, and the same file and git checks after it returns.

The default planner, `megamaid:planner`, writes one instruction file per finding and never edits source. A planner from outside this plugin gets the same authority instruction and its lens; a code-shaped plan run counts the output folder after it returns, and that is the only check (a plan run has no git checks).

### Add or swap reviewers

```json
{
  "agents": {
    "react-expert": {
      "subagent_type": "react-expert",
      "when_to_use": "Diff includes React components, hooks, or JSX."
    },
    "simplifier": { "subagent_type": "pr-review-toolkit:code-simplifier" },
    "test-auditor": null
  }
}
```

A new role needs `subagent_type` and `when_to_use`. Overriding a shipped role can set just the fields you change. `null` removes a role.

### Use your own directives

```json
{ "directives": { "user_path": "docs/our-rules" } }
```

## Directives

The plugin ships eight directives in `directives/`:

- `simplicity.md`: no overengineering or speculative fixes
- `modularity.md`: single responsibility, clear interfaces
- `reusability.md`: no copy-paste, no premature abstraction
- `maintainability.md`: naming, comments, no dead code
- `quality.md`: correctness, error handling
- `consistency.md`: follow existing patterns and the spec
- `scope-discipline.md`: stay inside the requested change
- `testing.md`: real tests that cover changed behavior

Your directives in `directives.user_path` (default `docs/directives/`) apply on top. Both sets are authoritative, and findings cite them as `<file>.md §N.N`. Agents get the files by path, not pasted into their prompt. To use only your own directives, set `"directives": { "include_plugin_defaults": false }`.

## Agents

Five read-only reviewers:

- `megamaid:code-reviewer`: bugs, logic, contracts, security
- `megamaid:simplifier`: overengineering, dead code, duplication
- `megamaid:silent-failure-hunter`: swallowed errors, hidden fallbacks
- `megamaid:test-auditor`: coverage and test quality
- `megamaid:consistency-auditor`: fit with existing patterns and with the spec or plan

Read-only is enforced by instruction. The edit tools are blocked, but Bash stays available for git.

Each finding must name a real cost, such as a failure mode, a coverage gap, or a maintenance burden. A clean diff should come back with few or no findings. `simplifier`, `silent-failure-hunter`, and `consistency-auditor` re-check their findings in a final step. `code-reviewer` and `test-auditor` dropped that step after an experiment showed it changed nothing.

Before a finding enters the report, `/megamaid:review` opens every cited line and recomputes every count. Each finding carries a `Verified:` line stating what was checked and what was not. `/megamaid:plan` re-checks anything marked unchecked.

Four more agents:

- **`megamaid:planner`** is the planner for `/megamaid:plan` and for the issues `/megamaid:fix` discovers.
- **`megamaid:implementer`** is the writer for `/megamaid:fix`.
- **`megamaid:pattern-scanner`** is used only by `/megamaid:patterns`.
- **`megamaid:pattern-shaver`** is used only by `/megamaid:patterns --shave`.

## How it works

- **Scripts do the bookkeeping.** `scripts/megamaid.py` merges config, resolves each agent's model and effort, matches directives to the focus brief, names reports, and batches fix items. Each dispatch prompt is a few lines plus the path to a per-run brief that the script writes. Planner and fix agents also get their role's brief in `shared/`. Working files live in `.megamaid/`, which ignores itself in git and is cleaned at the end of each run.
- **Agents get a manifest excerpt, not the whole file.** `scripts/manifest.py` cuts the PATTERNS manifest down to the sections whose scope matches the change, and lists the omitted sections by line range. The rules are in `shared/manifest-slicing.md`. Add a one-line `Home:` to a section if it is included too often.
- **The skills are the contract.** `skills/*/SKILL.md` and `shared/*.md` define the behavior, and `CHANGELOG.md` records every change to it. Skills run in your session's model; agents get the model from config on each dispatch.

## Development

[PLAYBOOK.md](PLAYBOOK.md) describes the workflow and design rules.

Release gate, in order:

1. `claude plugin validate .`
2. `scripts/check-contract.sh` runs the free checks:
   - The shared blocks are not copied into skills, and every reference resolves.
   - The help defaults match `config/defaults.json`.
   - The agent files are consistent.
   - The fixture tests for the scripts and the grader replay pass.
   - Every skill but help carries the stop line, equal to `hooks/stop-line.ts`.
   - The hooks module type-checks (`tsc`) and its tests pass (`claude plugin test`).
3. `claude plugin eval . --scaffold --ablation none --runs 1 --allow-tools Bash Write Edit` runs the eight behavioral cases in `evals/`, at about 5 USD per pass. On macOS it needs a standalone git, such as Homebrew's. `evals/README.md` explains the flags.

`scripts/smoke.sh` runs the free gates plus three short `claude -p` runs (about 0.25 USD): help with the module on, with proof it loaded, and review with the module off, which must stop. Run it once before a PR.

The hooks module type-checks against a pinned copy of the engine's types in `vendor/claude-code-types/`. To refresh it for a new Claude Code: run `claude --plugin-dir .` once, then `scripts/sync-types.sh`, and commit the result on its own as `chore(types): Claude Code X`. `scripts/replay-graders.py` re-scores a kept eval run for free. `experiments/` holds two-arm runs that test whether a prompt passage is still needed: run them with `--eval-dir experiments`, and see `experiments/README.md` for results.

CI runs gates 1 and 2 on every push. The eval suite runs on manual dispatch.

## Status

v0.3.0. See [CHANGELOG.md](CHANGELOG.md); earlier history is linked from its 0.1.0 entry.

## License

MIT
