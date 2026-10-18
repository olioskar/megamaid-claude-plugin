# Tooling: this machine and CI

Baseline: macOS, `/bin/bash` 3.2.57, Apple tools; CI is `ubuntu-latest` with GNU tools. Every script passes on both. Last column as in [engine.md](engine.md).

## grep and git grep

| Fact | What the gates do | Checked |
|---|---|---|
| `git grep -E` has no `\b` (exit 1, no match); `-w` and `git grep -P '\b…\b'` work | Word matches use `-w` | machine |
| The interactive `grep` is an alias for `/usr/bin/grep --color=auto`, BSD grep 2.6.0, which accepts `\d`; GNU grep's ERE does not | A pattern read by JavaScript and `grep -E` alike stays in common ERE (`[0-9]`); check-contract §5 refuses `\d`, `\w`, `\s` in `REPORT_NAME` | machine (BSD); unverified (GNU) |
| A pattern starting with `--` is read as an option: exit 2, which a `grep -q` chain reads as "no match" forever | Such patterns go through `-e` (the §5 planner-lane greps) | machine |
| `grep … \| grep -q` can SIGPIPE the first grep under `set -o pipefail` (exit 141) | The last grep uses `>/dev/null`, not `-q` (smoke's `not_loaded`) | machine |
| Under `pipefail`, piping a function expected to return 1 into grep takes the function's exit | `{ fn … \|\| true; } \| grep` (check-contract's guard self-tests) | code |
| `git grep` on an unreadable tracked file prints an error and exits 1, the same as "no match" | The old-name guard fails closed on any git grep stderr ([gates](../architecture/gates.md)) | machine |
| `color.ui=always` colours `git grep` output and breaks line parsing | The guard passes `--no-color`; a self-test runs it under `color.ui=always` | code |

## Paths and python

| Fact | What the code does | Checked |
|---|---|---|
| `/tmp` is a symlink to `/private/tmp` | Paths are compared by `os.path.samefile` (migrate.py); the `notice-same` fixture reaches the project root through a symlink so the case runs on Linux too | machine |
| `python3 -I` drops the script's directory from `sys.path` | `megamaid.py` loads `migrate.py` by file path (`importlib.util.spec_from_file_location`) from next to itself, never from `--plugin-root` | machine |

## Claude Code on this machine

| Fact | Consequence | Checked |
|---|---|---|
| `claude --version` is 2.1.302; the vendored types and the CI pin are 2.1.299 | check-contract prints `WARN: vendored types are Claude Code 2.1.299, this claude is '2.1.302'` until a types refresh lands (the refresh steps: [gates](../architecture/gates.md), the vendored types pin) | machine |
| Laying `.claude-plugin/types/` unattended (why an interactive session is needed: [engine.md](engine.md), Types) | `expect` (`/usr/bin/expect`) drives one `claude --plugin-dir . --model haiku`: wait for the prompt, send `/exit`; then `scripts/sync-types.sh` | machine (expect present); unverified (recipe) |
| `check-contract.sh` is not offline: `claude`, `node` and `npx` on PATH, network on the first `npx` run (typescript@5.9.3) | | code |
| smoke's module-off review is capped by `--max-turns 2`, not a dollar cap: one turn with this machine's global context (about 37k tokens of MCP servers and plugins) is most of smoke's cost ([costs](costs.md)) | A dollar cap under one turn's cost would stop the run before the token line | code (cap); unverified (share); unverified (context size) |

## CI

Triggers, jobs and the cost cap: [gates](../architecture/gates.md), CI. One quirk beyond it: `gh pr checks --watch` can answer "no checks reported" before the run registers, so wait for `gh run list --branch <b>` to show the run first (unverified).
