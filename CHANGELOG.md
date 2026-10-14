# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
