# megamaid eval suite

Behavioural regression tests for the megamaid plugin, in the `claude plugin eval` format: nine cases, each `<case>/prompt.md` + `<case>/graders/*.md`, with a `scaffold.sh` and `case.yaml` for every case but `help-overview`. When to run it: [docs/process/dev-flow.md](../docs/process/dev-flow.md), "Eval cadence". What it does not cover: `issues.yaml` (area `evals`).

## Case layout

- `prompt.md` frontmatter carries `name`, `tags`, `runs`, `max_turns`, `timeout_seconds` and `allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]`; without `Read` there the session cannot open the plugin's own `shared/` and `skills/` files.
- A scaffolded case has `case.yaml` with `schema_version: "1.1"`, `name` and `context.scaffold_script: scaffold.sh`; `scaffold_script` is not a `prompt.md` key. Every scaffold with a git repo commits its initial state so a reviewer's `git diff HEAD` has a HEAD.
- Bash, Write and Edit come from the CLI (`--allow-tools Bash Write Edit`); a case cannot grant them.

## Grader shapes

- Facts about tool calls (what is dispatched, with what prompt, what is read) are `tool_used`, `file_exists` and `regex` graders. Exact text is a `regex`, never a judge.
- The LLM judge's `trace` view is the first and last 12 messages, so a 40 to 100 message run cannot be judged on its middle: the one `llm` grader (`config-null-delete/no-simplifier`) reads `last_message` and confirms the final report only. Report contents are graded with `target: { source: file, path: … }`.
- The final message follows the skill's templates closely but not byte for byte, and the default judge is a small model: graders on it match the template's fixed labels (`Plan: skipped … Fix: skipped`) with slack between them; the outcome is graded from files and tool calls.
- No grader counts raw git commands: the fix steps are graded by their `megamaid.py fix` calls and output, so a git run under another path (see macOS below) still counts.
- `fix-reviewer-diff-scope` grades the fix round's mechanical steps by their `fix` subcommands (`\bfix start\b` and so on, not the script path: the 2026-10-30 run called `python3 -I $M fix start` with the path in a variable): one `fix start`, and at least two `fix check` and two `fix verify` for two sequential items; the commits by the `commit M<n>: <sha>` lines `fix commit` prints, read from the trace.
- `overrides-listed` checks the end-of-run summary's `Overrides:` line, which lists every verdict the orchestrator acted against.
- `module-loaded.md` in every case but `help-overview`: a `not_contains` grader for `MEGAMAID-MODULE-NOT-LOADED`, so a run whose hooks module did not load fails instead of passing its negative graders. `check-contract.sh` §11 keeps the file exact.
- `usage-ledger.md` in `noncode-shortcircuit` and `plan-native-planner`: a `file_exists` grader for the module's ledger (`docs/megamaid/reviews/*-usage.md` beside the sweep's report; `.megamaid/usage/plan-*.md` for the plan run). Both pass `scripts/test-replay.sh` against synthetic fixtures and both passed live in the 0.4.0 suite run (2026-10-18), which settled that a relative `$.fs.write` lands in the eval workspace and the runner's glob matches a dot-directory.

## Run

```bash
claude plugin eval . --scaffold --ablation none --runs 1 --max-cost-usd 15 \
  --allow-tools Bash Write Edit --no-publish --trust-plugin   # one run per case, bounded
claude plugin eval . --scaffold --allow-tools Bash Write Edit --case "help-*"
```

- Measured: nine cases, one run each, pinned like CI (Opus 5.5, Sonnet 5.5 judge), about 12 minutes and 5.23 USD. The 0.4.0 run (2026-10-18, unpinned, Claude Code 2.1.303): 8/9, 832 s, 4.53 USD; `manifest-slice` missed `orchestrator-never-reads-manifest` once and passed alone on re-run (`issues.yaml` MM-043). The two usage-ledger graders and `no-stray-file` passed live. The `feat/call-time-guarantees` run (2026-10-29, Claude Code 2.1.312): 6/9, 752 s, 4.63 USD; `ledger-sonnet` passed live; `config-null-delete`'s judge failed with a subscription weekly-limit error although the key was set (re-run alone: passed, and a one-case judge probe with the key passed, cause unknown); `manifest-slice` missed `orchestrator-never-cats-manifest` (MM-043; passed alone); `fix-auto-off`'s refusal said "`fix.model_invocation` is `false`", not the template's `fix.model_invocation: false`, so the grader now accepts both (replayed against the kept run: fails before, passes after). The `feat/fix-mechanics` run (2026-10-30, Claude Code 2.1.314, `--keep-temp`): 8/9, 780 s, 4.40 USD; the miss was `manifest-slice`'s `orchestrator-never-cats-manifest` again (MM-043, `cat -n docs/megamaid/PATTERNS.md`). The MM-043 fix (review Step 7's convention-claims rule) then ran `manifest-slice` 4 times (3.68 USD): 3 passed; the fourth failed `orchestrator-never-reads-manifest` on the code-reviewer subagent's ranged Read (`offset 10, limit 30`), while the orchestrator itself read by range (`sed -n '14,21p'`), so the grader now skips ranged reads (replayed on the kept run: fails before, passes after). Before it, `fix-reviewer-diff-scope` alone scored 0.64 on graders that matched the script path and an `Overrides:` line the summary left out; both fixed, it passed 1.00.
- One `--case` per command: given twice, only one case runs.
- `--ablation none` for pass/fail; the default `with-without` arm runs every case a second time without the plugin.
- CI pins `--model` and `--judge-model` so a model rollout is not read as a plugin regression; the local command floats on purpose.
- Output lands under `evals/results/` (gitignored).
- `scripts/smoke.sh` runs the free gates plus three short `claude -p` runs (about 0.25 USD); it is not offline.

**git on macOS.** Inside the eval sandbox `/usr/bin/git` is Apple's xcrun shim, which needs `/Library/Developer/CommandLineTools`, and the sandbox cannot read it. A standalone git (`brew install git`) works, but the agent's shell puts `/usr/bin` first (`path_helper` reorders `PATH`), so plain `git` fails and the agent finds `/opt/homebrew/bin/git` itself, in varying forms (full path, `export PATH=…`, `G=…; $G commit`). `fix-auto-on` turns per-item commits off so it needs no commits of its own.

## Replay a grader offline

To debug a grader without paying for a re-run, keep one run and replay the case's `regex`, `tool_used` and `file_exists` graders against it (`llm` graders are skipped):

```bash
claude plugin eval . --scaffold --ablation none --runs 1 --allow-tools Bash Write Edit \
  --no-publish --trust-plugin --keep-temp --case <name>   # prints "kept temp: /private/tmp/e-XXXX"
chmod 700 /private/tmp/e-XXXX /private/tmp/e-XXXX/sealed
python3 -I scripts/replay-graders.py evals/<name> /private/tmp/e-XXXX
```

`scripts/test-replay.sh` (run by `check-contract.sh`) replays the real graders of four cases against synthetic kept runs in `scripts/fixtures/replay/`: `fix-reviewer-diff-scope` (`fix-pass`, `fix-fail`), `noncode-shortcircuit` (`noncode-pass`), `plan-native-planner` (`plan-pass`, `plan-fail`) and `manifest-slice`'s `ledger-sonnet` alone (`review-sonnet-pass`, `review-sonnet-fail`), so a misspelled grader shows up for free.

## Cases

| Case | What it checks | Graders |
|---|---|---|
| `help-overview` | Help text verbatim, every command listed | `overview-header`, `all-commands-listed`, `sections-verbatim` |
| `config-null-delete` | `null`-as-delete merge semantics: a deleted role is not dispatched | `no-simplifier`, `no-simplifier-dispatch` |
| `noncode-shortcircuit` | `/megamaid:vacu-suck` on a prose artifact announces the short circuit and runs no plan or fix; the module's ledger lands beside the report | `announces-shortcircuit`, `design-doc-untouched`, `no-edits`, `no-plan-files`, `usage-ledger` |
| `fix-reviewer-diff-scope` | The fix reviewer gets `shared/fix-reviewer-brief.md` and never says `HEAD~1`; the run baseline, the checks after each implementer and the verification before each commit go through `megamaid.py fix`; both items commit; the summary lists `Overrides:` | `reviewer-brief-delivered`, `reviewer-never-head-tilde`, `fix-started`, `fix-checked`, `fix-verified`, `m1-committed`, `m2-committed`, `overrides-listed`, `m1-applied`, `m2-applied` |
| `dispatch-delivery` | Foreign agents (the scaffold overrides the planner with `general-purpose`) get the run brief, not an embedded directive body: `authority-sentence` and `directive-paths-listed` read the `form:` and `directives:` lines `megamaid.py brief` prints into the trace; `brief-delivered` checks the Agent prompt carries the brief path; the summary ends `Next: /megamaid:fix …` (one pair of backticks allowed) and never names `fix-auto` | `authority-sentence`, `directive-paths-listed`, `brief-delivered`, `no-embedded-directive-body`, `plan-file-written`, `next-names-fix`, `never-names-fix-auto` |
| `plan-native-planner` | The only case that runs `agents/planner.md`: `/megamaid:plan` on a two-finding report spawns `subagent_type: megamaid:planner` twice with `form: native`, writes both instruction files, leaves `src/util.js` and `src/config.js` as scaffolded, makes no Edit call, reports `Medium (2)` with nothing missing or unexpected; `no-stray-file` fails on any instruction-folder file not named `M*.md` | `planner-dispatched`, `native-form`, `brief-delivered`, `m1-file-written`, `m2-file-written`, `util-untouched`, `config-untouched`, `no-edit`, `medium-label`, `no-missing`, `no-unexpected`, `no-stray-file`, `next-names-fix`, `usage-ledger` |
| `manifest-slice` | Agents get a per-run excerpt (entity-page section in, pdf and theme out) and the orchestrator never prints or reads the manifest body (a read by line range, which the manifest rules allow any agent, is not counted; `tool_used` sees subagents' calls too); `excerpt-path-in-dispatch` and `full-path-in-dispatch` read the `baseline:` line the brief prints; `Verified:` lines in the report; `.megamaid/excerpts` cleaned (briefs share the excerpt's run stem); the scaffold sets `code-reviewer` to sonnet and `ledger-sonnet` reads that row's model in the review ledger, so the model set at spawn is graded where it lands, not on the Agent call | `excerpt-path-in-dispatch`, `full-path-in-dispatch`, `brief-delivered`, `excerpt-log-line`, `orchestrator-never-reads-manifest`, `orchestrator-never-cats-manifest`, `report-has-verified-lines`, `excerpts-cleaned`, `ledger-sonnet` |
| `fix-auto-off` | The model-only fix entry refuses without `fix.model_invocation: true`, naming the observed value and `/megamaid:fix`, with no edits | `refuses-naming-flag`, `names-slash-command`, `no-edits`, `no-writes` |
| `fix-auto-on` | The model-only fix entry runs the fix workflow and applies the plan when the flag is set | `no-refusal`, `fix-applied` |

Every case but `help-overview` also carries `module-loaded`.
