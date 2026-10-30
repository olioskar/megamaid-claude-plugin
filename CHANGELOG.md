# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`megamaid.py fix` commands do a fix round's mechanical steps.** `fix preflight` (the dirty-tree list), `fix start` (the run baseline: verification, `D0`, `HEAD`, and the items not to dispatch), `fix gate`, `fix check` (the three checks after an implementer returns), `fix revert` (with the `## Attempts` entry), `fix verify` (against the baseline, a new failure attributed to an item), `fix commit` and `fix resync`. Each step had one right answer that the orchestrator used to work out from prose, command by command; now each is exact and pinned by a fixture test. The commands find a runnable git themselves and exit 2 when none runs.
- **A plan can name `**Depends on:**`.** The planner writes the codes of findings whose fix its `## How` assumes is already in, and `batches` runs the item in a later batch than each of them; a code a group consolidated stands for the group.

### Changed

- **Fix and vacu-suck call the `fix` commands instead of spelling out git.** A command reports a verdict and never decides the next step: the orchestrator acts on it, or acts otherwise with a reason, and every such override (and any git step outside the commands, followed by `fix resync`) is listed under `Overrides:` in the end-of-run summary and in every halt's status list.
- **Execution order is `batches`' order** in fix and vacu-suck: severity, then an item after the ones it depends on.

### Fixed

- **An item planned against another item's change no longer runs first** (MM-047). The 2026-10-28 baseline's D1 assumed G1's change; severity order put D1 first, and only the orchestrator's own reorder saved the run.
- **With per-item commits off, a later item on the same file runs.** A finished item's paths used to join the user's dirty baseline, so a later item on the same file was not dispatched. Now they are recorded with their content: the later item's checks count only what it changed, and its revert keeps the earlier item's edit.

## [0.5.0] — 2026-10-29

The hooks module now enforces at call time the rules megamaid's agents used to keep from prose alone, and sets each briefed agent's model from config. The free gates (88 module tests), smoke and the eval suite ran; the suite's three misses were a judge auth error, a known flake (MM-043) and a grader too literal for a correct refusal, each re-run or replayed green.

### Added

- **The hooks module refuses a megamaid agent's out-of-bounds call as it is made.** A fix implementer's Edit or Write outside its item's write-set, and a planner's to any file but its output file, are refused with the boundary named and an instruction to stop and report a divergence; a fix reviewer's diff past `HEAD` (`HEAD~1`, `HEAD^`) is refused with the `git diff HEAD -- <files>` form to use; a dispatch whose run brief is for another agent than config names is refused before it starts. These were prose rules the model sometimes broke (the 2026-10-28 baseline saw a planner sent with the implementer's brief). Only megamaid's own agents are checked; the main loop and other plugins' agents are not. A guard that faults refuses any subagent's Edit, Write or Bash call, another plugin's included, rather than letting it through.
- **The configured model is set at spawn.** A briefed dispatch that names no model runs on what `megamaid.py resolve` gives for its role and lane, so the model no longer depends on the orchestrator passing it. A model the dispatch names still wins, for a one-run override.
- **`megamaid.py write-set --file <instruction>`** prints one instruction's write-set by `batches`' rules; the hooks module runs it when an implementer starts.

### Changed

- **Briefed dispatches no longer pass `model`** unless the user named one for the run; patterns' briefless scanner and shaver still do. The fix implementer's prompt carries a `Class: trivial|standard` line, which picks its model lane.
- **Fix skips an item whose instruction names no file** and announces `<code> — not dispatched: the instruction names no file`; it used to run alone, and its implementer's every edit would now be refused.
- **The eval graders that matched `"model"` on the Agent call are gone.** `manifest-slice` sets `code-reviewer` to sonnet in its config and checks the review ledger's row instead, since the model is now set at spawn.
- **`fix-auto-off`'s `refuses-naming-flag` accepts the flag named in prose** ("`fix.model_invocation` is `false`") as well as the template's `fix.model_invocation: false`; a correct refusal worded the first way failed the 2026-10-29 suite.

- **Chat after a run no longer inflates the orchestrator's row.** A main-loop turn is counted only when the run did something since the last counted one (the first turn always; then a dispatch, a dispatched agent's turn, or the review report's Write owes the next). The ledger was counting every main-loop turn until the next run or session end, so a question asked after the summary changed a committed ledger. The one turn this misses is an answer to the run's own question that dispatches nothing, such as "run again?" answered no.
- **Vendored engine types refreshed to Claude Code 2.1.303** (CI installs that version). 2.1.303 dropped the `re-entry` hook-failure kind, so the usage hooks' failure log no longer special-cases it.
- **Review Step 8 names the Write tool for the report.** The hooks module finds the report by its Write call to place the usage ledger beside it; a report assembled with a shell heredoc or Edit left no ledger. Review's closing note now lists the ledger among the files a run creates.
- **The eval suite ran for 0.4.0** (2026-10-18, 8/9, 4.53 USD): the two `usage-ledger` graders and `no-stray-file`, verified by replay only at release, pass live. The one miss, `manifest-slice`'s `orchestrator-never-reads-manifest`, did not recur when the case ran alone; it is tracked as MM-043.
- **`PLAYBOOK.md` is replaced by `docs/process/dev-flow.md`**, and `docs/` and the session memory `.claude/memory/main.md` are tracked. The process, the architecture notes, the handover, the memory and the backlog (`issues.yaml`) live in the tree, so a fresh session reads the current state from git instead of from per-contributor local files.

### Fixed

- **A planner sent with the implementer's brief** is refused at spawn instead of running mislabelled (MM-044).
- **Fix's pre-flight no longer counts the run's own report and plans** as uncommitted work, so a sweep asks only about the user's changes (MM-045).
- **A write-set no longer holds a bare `/`** picked up from prose such as "`names` / `targets`" in `## Where` (MM-046).
- **A fix reviewer that wants a change returns FAIL**, never PASS with a note, and the orchestrator never edits a file in a write-set except to revert; the baseline saw it patch a whitespace slip itself (MM-048).

## [0.4.0] — 2026-10-18

The hooks module now says what a run cost. Built in an unattended session; the eval suite did not run for this release (the free gates and 52 module tests did), so the two new `usage-ledger` graders are verified by offline replay only.

### Added

- **A usage ledger per run.** The module sums every `turn.complete` of a run per role, from the token counts the engine reports, and writes a Markdown ledger as the run goes: beside the review report for `/megamaid:review` and `/megamaid:vacu-suck` once the orchestrator has written it, named like the report with `-usage.md` for `-report.md` (`pr-12-round1-usage.md`); under `.megamaid/usage/<skill>-<startedAt>.md` for the other commands. One row per lane and role (`review/code-reviewer`, `fix/implementer`; the briefless patterns agents by type), the orchestrator's row first, a total, the orchestrator's share of input and of output tokens, and a cost line (the session's spend from run start to the last counted turn, so it includes anything else done in the session meanwhile). A run ends at the next run's start or at session end: there is no earlier signal the module can trust, so main-loop turns after the run's last answer are counted, the file is rewritten on each of them, and the turn count makes that visible. A run stored by 0.3.x across a hot reload has no usage and is left uncounted until the next run. A hook that fails is replayed and named in the debug log (`usage hook failed: …`). This is the Phase 2 baseline instrument; the measurement itself (one full loop) is still to run.
- **Nested spawns count toward the parent role.** An agent a reviewer spawns is recorded under the reviewer's lane and role, with a `parent` field, so the ledger's split is honest about helper agents. The writer roles cannot spawn.
- **Contract checks.** `hooks/ledger.ts`'s report-name pattern must match what `megamaid.py report-name` prints (§5); `usage.ts` joins the files that declare the state ref (§12); the three writers of `.megamaid/.gitignore` (`megamaid.py`, `manifest.py`, `usage.ts`) must agree on its one line (§5).

## [0.3.1] — 2026-10-14

### Fixed

- **Contract check §8 reads the frontmatter only.** The writer agents' `disallowedTools` lines were matched anywhere in the file, so a line moved into the body passed; a `tools:` allowlist (which could drop Write) was not refused. Both are caught now.
- **`plan-native-planner` catches a stray planner file.** A new `no-stray-file` grader fails on any file in the instruction folder not named `M*.md`, so an extra file is caught without relying on the orchestrator printing `Unexpected:`.
- **Wording.** The planner file names grouped findings; `shared/dispatch-delivery.md` says the non-code revise-doc dispatch delivers the run brief alone; the eval scaffold comment says what the case gates and what §8 gates.

## [0.3.0] — 2026-10-14

The planner becomes its own role. Nothing a plan run produces changes: the eval suite passes 9/9 (5.23 USD, Opus 5.5 with a Sonnet 5.5 judge), the eight 0.2.0 cases at their 0.2.0 cost.

### Added

- **The `planner` role (`agents/planner.md`, `agents.planner`).** `/megamaid:plan` and the issues `/megamaid:fix` discovers now dispatch `megamaid:planner`, a senior developer who reads the code, reproduces the finding and writes one instruction file an implementer applies cold. Its boundaries are written for planning: exactly one file, the output file its prompt names; never a source edit (`Edit` is withheld, `Write` and `Bash` stay for the one file and for `git log`, `git blame`, `grep`); never git, agents or skills. Override it per project with `agents.planner`, separately from the fix writer.
- **Eval case `plan-native-planner`.** The only case that runs the shipped planner: two findings, no override, graded on the `megamaid:planner` dispatches, the native brief, both instruction files, the source files left untouched, and the summary. Its graders replay offline against synthetic pass and fail runs (`scripts/test-replay.sh`), so a broken grader shows up for free.
- **Contract checks.** Planning resolves and briefs `--role planner` in any flag order (a line-scoped check, not a prose match); both writer agents' `disallowedTools` lines are asserted exactly, since `claude plugin validate` accepts any text there; the fixture plugin's `defaults.json` must equal the shipped one.

### Changed

- **The implementer is the fix writer only.** Its agent file and `when_to_use` drop the plan clause; an `agents.implementer` override no longer applies to planning. No migration: the plugin has no users yet.
- **Model guidance: keep the planner strong, save on the implementer.** The planner decides the quality of a fix, so a good instruction lets a cheaper implementer apply it. README and help say so; the README example and the configure sample now lower `models.fix.implementer_standard` instead of `models.plan`.

## [0.2.0] — 2026-10-14

megamaid now requires a Claude Code build with hooks modules, with its module loaded. The pipeline itself is unchanged: the eval suite passes 8/8, matching comb v0.15.0 once its two grader-shape misses were fixed, at the same cost (4.56 vs 4.64 USD, Opus 5.5 with a Sonnet 5.5 judge).

### Added

- **A hooks module (`hooks/`).** It registers on `skill.prompt`, `tool.call` for Read, `agent.spawn`, `session.start` and `session.end`, and logs its load with the Claude Code version at session start, so `scripts/smoke.sh` can prove it ran. Observers refuse nothing: every hook at a site that could refuse passes the call through on a fault.
- **A stop line at the top of every working skill.** The module strips it when the skill loads. Without the module the model reads it and replies `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help` instead of running the pipeline unguarded, which is the point: a guard that does not load must not be a silent gate. `/megamaid:vacu-suck` and `/megamaid:fix-auto` Read sub-skill files that open with the line, so a main-loop Read of one of them gets a note that the line does not apply while the module is loaded.
- **Run detection.** Starting a megamaid skill records a run in state (`megamaid.run`). Each main-loop dispatch whose prompt names a run brief is recorded under its agent id with role, lane and run stem; the briefless patterns scanner and shaver are recorded while the run is `/megamaid:patterns`. `/clear` or session end clears the run. This is the ground for the Phase 2 usage baseline and the Phase 3 guarantees; nothing is enforced yet.
- **A `Requirements` block in `/megamaid:help`,** naming the token and the causes of a module that did not load: an old build, `disableAllHooks`, the rollout switch, and a fix-auto or vacu-suck run inside a subagent.
- **Pinned engine types in `vendor/claude-code-types/`,** refreshed by `scripts/sync-types.sh` (fixture-tested). `check-contract.sh` now runs `tsc` and `claude plugin test`, keeps every copy of the stop line equal to `hooks/stop-line.ts`, and compares the installed Claude Code with the vendored version: a warning locally, a failure in CI.
- **The `module-loaded` eval grader** in every case but `help-overview`, so a run whose module did not load fails instead of passing its negative graders. `scripts/smoke.sh` also runs review with the module off and checks that it stops.

### Changed

- **Breaking: megamaid needs a Claude Code build with hooks modules.** Developed against 2.1.296 (the vendored types); the release gate ran on 2.1.299. comb stays the plugin for older builds.
- **CI installs the Claude Code version the vendored types name** instead of the latest, so an engine rollout is not read as a plugin change.

## [0.1.0] — 2026-10-12

Forked from comb 0.15.3. comb's version history is in [its CHANGELOG](https://github.com/olioskar/comb-the-desert-claude-plugin/blob/main/CHANGELOG.md). The review → plan → fix pipeline behaves as in comb 0.15.3.

### Changed

- **The plugin is `megamaid`.** Commands are `/megamaid:*`, agent types `megamaid:<agent>`, the helper script `scripts/megamaid.py`. megamaid shares no command, config file or output path with comb. With both installed, their model-invocable skills trigger on the same phrases (see README).
- **`/comb:the-desert` is `/megamaid:vacu-suck`.** The config keys `models.the_desert` and `effort.the_desert` are now `models.vacu_suck` and `effort.vacu_suck`, and the `--coerce` value follows.
- **Config lives in `megamaid.config.json`** (`~/.claude/` and `<project>/.claude/`). A `comb.config.json` is never read, so comb settings can't silently steer megamaid.
- **Output paths default to `docs/megamaid/`** (reviews, plans, `PATTERNS.md`), and run state to `.megamaid/`.

### Added

- **Notices for files from a comb install.** `megamaid.py config` names a comb config that has no megamaid counterpart, and a comb PATTERNS manifest that megamaid doesn't read, so nothing is ignored without a word.
- **`megamaid.py migrate config` and `migrate manifest`.** `/megamaid:configure` offers them: the config is translated to megamaid's keys (dropped keys are listed), and the manifest is moved or copied instead of rescanned. `/megamaid:patterns` makes the same manifest offer before a scan. The offer text is in `shared/manifest-migration.md`.
- **An old-name guard in `scripts/check-contract.sh`.** It fails on any comb identifier in tracked files or paths, outside `CHANGELOG.md`, `scripts/migrate.py`, its fixtures, and lines that link comb. It fails closed and tests itself.

### Removed

- **The review trigger "comb through changes".** It named the old plugin; the other review triggers are unchanged.
- **The marketplace install line in the README.** megamaid gets its marketplace entry at its first public release; until then it installs with `--plugin-dir`.
