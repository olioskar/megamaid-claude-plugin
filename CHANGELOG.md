# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
