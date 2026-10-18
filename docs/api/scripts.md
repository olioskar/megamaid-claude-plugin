# Scripts

Two stdlib-only Python tools do the deterministic work the skills must not re-derive in prose. Run from the project root as `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/<tool>.py" <subcommand> …`; `-I` keeps the cwd and the script directory off `sys.path`. Every stderr line is `megamaid.py: <msg>` or `manifest.py: <msg>`, plus `warning:`, `notice:` and `dropped:` lines where named; argparse usage errors (`usage: …`, exit 2) aside. `--help` on either lists the subcommands.

## scripts/megamaid.py

Config flags on `config`, `resolve`, `directives`, `brief`, `migrate *`: `--plugin-root P` (default: the script's parent directory), `--home H` (default `~`), `--project-root R` (default: git toplevel, else cwd). The full contract is the docstring, `scripts/megamaid.py:1-98`.

| Subcommand | Arguments | Prints (stdout) | Exit 2 | Called by |
|---|---|---|---|---|
| `config` | config flags | merged config as JSON, keys sorted, indent 1; stderr `warning:` then `notice:` lines ([config.md](config.md)) | invalid JSON, not UTF-8, or top level not an object (first bad layer), OS error, defaults missing | every skill but help |
| `resolve` | `--role R --lane L [--coerce vacu_suck]` | `subagent_type: …`, `model: …`, `effort: <low…max\|unset>`, `native: yes\|no` (native: `subagent_type` equals `megamaid:` + a `name:` in `<P>/agents/*.md`) | role absent, lane absent or not a string, effort outside the five values | review, plan, fix, patterns (vacu-suck through review, plan, fix) |
| `directives` | `[--brief "<text>"]` | `plugin: <abs>` (sorted; none when `include_plugin_defaults` is false), `user: <abs>` (sorted), then `primary: <abs>` per match or `primary: none`; stderr `warning: directives.user_path <p> is not a directory; no user directives` | — | review, plan, fix, vacu-suck |
| `brief` | `--skill review\|plan\|fix\|patterns --role R [--run <stem>] [--excerpt <path>] [--manifest <path>] [--brief "<text>"]` | `run: <stem>` (only when minted), `brief: <abs path>`, `form: native\|foreign`, `directives: <n> plugin, <m> user; primary: <basenames\|none>`, `baseline: <excerpt> (excerpt) + <manifest> (full manifest)` / `<manifest> (full manifest, no excerpt)` / `none`; writes `.megamaid/excerpts/<stem>.<skill>.<role>.brief.md` under the cwd | role absent, `--run` not `<skill>-<digits>-<hex4>`, `--excerpt` or `--manifest` not a file, `--excerpt` without `--manifest`; the `user_path` warning as for `directives` | review, plan, fix (vacu-suck through them) |
| `report-name` | `--reviews <dir> (--pr N \| --branch <name>)` | `report: <dir>/<pr-N\|branch-<slug>>-round<R>-report.md`, `round: <R>`; R = 1 + highest round parsed from matching filenames, 1 when none or no directory | `--branch` empty after slugging, unreadable directory | review |
| `batches` | `--folder <plan folder>` | `shape: per-finding\|single-revise-doc\|empty`, `write-set <code>: <paths>\|(none)` per item, `not-reproduced: <codes>\|none`, `batch <n>: <codes>` | folder missing or unreadable; per-finding and `revise-*.md` mixed; two files with one code; two `revise-*.md` | fix |
| `findings` | `--report <path>` | `{"count", "shape": "code-shaped\|non-code\|unknown", "findings": [{code, title, source, files, verified}]}`, indent 1; a parse surprise is count 0, never a traceback | report missing or unreadable | plan |
| `migrate config` | `--layer home\|project` | the layer's earlier config translated, JSON indent 2, input order; stderr `dropped: <key>` | missing, invalid JSON, not an object | configure |
| `migrate manifest` | `--move \| --copy` | `moved\|copied <src> -> <dst>` | no earlier manifest, `paths.patterns` null, target exists, OS error | configure via `shared/manifest-migration.md` |

Primary directives (`megamaid.py:348-371`): the brief is split into lowercase words; a word of four or more characters makes a directive primary when it is a substring of the file's basename (without `.md`), a shorter word only when it equals a whole hyphen-separated segment of it. The batch rule (`:623-643`) in [../features/fix.md](../features/fix.md). Slug rule (`:532-536`): `/`, whitespace, `\ : ? * < > | "` become `-`, runs collapse, ends trimmed. Any `migrate` command, and `config`, exits 2 with `cannot load scripts/migrate.py: <error>` when `scripts/migrate.py` is not beside the script.

Real output: `scripts/fixtures/megamaid/expected/*.out` (each ends with `exit=<code>`); `batches-code.out` whole:

```
shape: per-finding
write-set H1: src/d.ts
write-set L1: src/c.ts
write-set M1: src/a.ts
write-set M2: src/a.ts src/b.ts
write-set M3: src/f.ts
write-set T1: (none)
not-reproduced: M3
batch 1: H1 M1 L1
batch 2: M2
batch 3: T1
exit=0
```

## scripts/manifest.py

Operates on a PATTERNS manifest; working files land under `.megamaid/excerpts/` in the cwd ([working-paths.md](working-paths.md)). The excerpt grammar is the docstring, `scripts/manifest.py:1-18`; the shave checks are `shared/shave-rules.md`.

| Subcommand | Arguments | Prints (stdout) | Exit | Called by |
|---|---|---|---|---|
| `excerpt` | `--skill S --manifest M --touched-from <file\|dir\|-> …` | `run: <stem>`, `excerpt: <abs path>`, `PATTERNS excerpt: <i> of <n> area sections included (<headings>); <g> global; omitted: <headings\|none>`, `stale: yes\|no\|unknown (<detail>)`, `base_commit: <hex\|none>`; writes `<stem>.md` | 3 when no file-shaped token is in the touched text (nothing written); 2 unreadable input | review, plan, fix (and vacu-suck through them) |
| `index` | `--manifest M [--skill S]` (default `patterns`) | `run: <stem>`, `index: <abs path>`, a size table (`header 1-<n> <b>B`, `area\|global <start>-<end> <b>B [<n>] <heading>` with ` edits=<path>` on area lines, `total <b>B ~<t> tokens (bytes/4); <a> area, <g> global`), `Large manifest — consider /megamaid:patterns --shave` past 100 KiB; writes `<stem>.index.json` | 2 unreadable | patterns |
| `anchors` | `--manifest M` | `missing\|beyond\|ambiguous  <token> — <heading>` plus ` (<detail>)` except for a missing full path, per line-carrying anchor that fails, then `anchors: <n> checked in <s> area sections; <u> unresolved (<m> missing, <b> beyond end), <a> ambiguous` and `bound: file existence and line bounds only; …` | 0 always on a readable manifest | patterns |
| `verify` | `--manifest M --index I --edits <json>… --out <json>` | `ok <section> [<class>]`, `FAIL <section> [<class>]: <check>`, `UNUSABLE <file>: <why> (file skipped)`, `verify: <p> passing, <r> rejected, <u> unusable file(s); passing set: <out>`; writes the passing set; with no `--edits`: `verify: no edit files given; nothing to verify` and an empty passing set | 1 when anything is rejected or unusable, else 0; 2 bad index | patterns |
| `gate` | `--edits <passing set> [--show "<heading>"] [--manifest M]` (unused) | `Nothing to shave: the passing set is empty (…). Run clean and stop.` or `Shave gate — <n> edits in <s> sections, <r> rejected. Reply: apply · skip <class> · skip <section> · show <section>` and per-section listings; duplicates collapse past 200 lines of full text | 0; 2 when the file has no `edits` key | patterns |
| `filter` | `--edits <passing set> [--skip-class …] [--skip-section …] --out <json>` | `filter: <k> of <n> edits kept → <out>` | 0; 2 bad file | patterns |
| `apply` | `--manifest M --index I --edits <passing set> [--stamp]` | `apply: <n> edits applied; <before> → <after> bytes (~<t> tokens, bytes/4)`; re-verifies first, all-or-nothing; `--stamp` writes or replaces a `**Shaved:** <date> (<before> → <after> bytes)` header line | 1 empty passing set or an edit no longer verifies (nothing written); 2 bad file | patterns |
| `clean` | `--run <stem>` | `clean: <n> file(s) removed for run <stem>`; removes `.megamaid/excerpts/<stem>*` | 2 when `--run` is not a run stem | review, plan, fix, patterns |

Run stems are `<skill>-<epoch seconds>-<4 hex>` (`manifest.py:88-89`, `megamaid.py:450-451`); `clean` accepts nothing else, so an empty id cannot sweep the directory. Real output: `scripts/fixtures/expected/*.out`.

## Fixture tests

All four run inside `scripts/check-contract.sh` (`:65-86`) and need no network or model.

| Script | Covers | Fixtures |
|---|---|---|
| `scripts/test-megamaid.sh` | every `megamaid.py` subcommand against a fixture plugin root, home and project from a temp cwd; the migration notices, translations and manifest moves on temp copies of 25 layouts | `scripts/fixtures/megamaid/{plugin,home,project,…}` → `expected/*.out`; `scripts/fixtures/migrate/layouts/` → `expected/*.out` |
| `scripts/test-manifest.sh` | every `manifest.py` subcommand in a temp git repo built from `cited-files.txt`, with the base-commit token rewritten; excerpts, index, anchors, verify pass and fail cases, gate, filter, apply with stamp, CRLF round trip, clean | `scripts/fixtures/*.md`, `*.touched`, `edits-*.json` → `scripts/fixtures/expected/` |
| `scripts/test-replay.sh` | `replay-graders.py` against synthetic kept-run directories for three eval cases: a pass and a fail run for `fix-reviewer-diff-scope` and `plan-native-planner`, a pass run for `noncode-shortcircuit` | `scripts/fixtures/replay/` |
| `scripts/test-sync-types.sh` | `sync-types.sh` on a temp repo: good source, missing file, bad first line | none (built inline) |

Output is normalised (temp paths to `TMP`, fixture root to `FIX`/`FIXTURES`, plugin root to `PLUGIN`, run stems to `RUN`; test-manifest.sh also rewrites the base commit to `BASECOMMIT0` and the `**Shaved:**` date to `DATE`) and diffed against the expected file; stdout and stderr are interleaved and the exit code appended as `exit=<n>`. To add a case: add the input under the fixture tree, add a `run <name> <subcommand> …` (megamaid) or a direct invocation writing `$OUT/<name>.out` (manifest) line, run the script with `--update` to write the expected file, and read the new expected file before committing it. An expected file no case produces fails `test-megamaid.sh` as stale.

## scripts/replay-graders.py

```
python3 -I scripts/replay-graders.py <case-dir> <kept-run-dir>
python3 -I scripts/replay-graders.py <case-dir> --trace <trace.jsonl> [--workspace <dir>]
```

Replays the `regex`, `tool_used` and `file_exists` graders of `<case-dir>/graders/*.md` against a saved trace (`<kept-run-dir>/out/trace.jsonl`, workspace `<kept-run-dir>/sealed/home/cwd`; `chmod 700 <dir> <dir>/sealed` first); `llm` and `baseline` graders are listed as skipped. Prints `✓`/`✗`/`skipped` per grader and `replay: <case> — OK|FAIL`. Exit 0 all pass, 1 a failure, 2 usage or input error. Bounds (JavaScript vs Python regex, `file_exists` seeing every file) are in its docstring, `scripts/replay-graders.py:1-21`. Kept runs come from `claude plugin eval … --keep-temp` ([../../evals/README.md](../../evals/README.md)).

## scripts/sync-types.sh

`scripts/sync-types.sh [<types folder>]` copies `<folder>/{claude-code,claude-code-tools}/index.d.ts` (default `.claude-plugin/types`, written by an interactive `claude --plugin-dir .`) into `vendor/claude-code-types/`, the pinned copy `tsc` and CI use; prints `sync-types: vendor/claude-code-types now holds Claude Code <v>` from the source's `// Written by Claude Code <v>.` first line. Exit 1 when a file is missing or that line is absent. See [../knowledge/engine.md](../knowledge/engine.md) for the engine types and [../architecture/gates.md](../architecture/gates.md) for the gate that runs all of this.
