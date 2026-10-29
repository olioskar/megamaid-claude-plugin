# Config

Source of truth: `config/defaults.json` (keys and types), `scripts/megamaid.py:161-224` (merge and validation), `scripts/migrate.py` (migration). Every skill but help reads the merged result through `megamaid.py config` ([scripts.md](scripts.md)).

## Layers and merge

| Layer | Path | Required |
|---|---|---|
| 1 defaults | `<plugin root>/config/defaults.json` | yes (exit 2 when missing) |
| 2 global | `~/.claude/megamaid.config.json` | no |
| 3 project | `<git toplevel, else cwd>/.claude/megamaid.config.json` | no |

Later layers win (`megamaid.py:191-204`). Dicts deep-merge; lists and scalars replace; a `null` value deletes the key at any depth (`megamaid.py:161-172`). A layer may start with a BOM; invalid JSON, non-UTF-8 text (`invalid JSON in <path>: not UTF-8 text`), or a top level that is not an object exits 2 at the first bad layer.

After the merge (`megamaid.py:205-223`): a non-object `agents` is replaced by `{}`, with a warning unless it is absent; `directives.include_plugin_defaults` that is not a boolean is coerced with a warning; a role that is not an object with string `subagent_type` and `when_to_use` is dropped with `warning: agents.<role> dropped — missing <keys>`. `warning: directives.user_path <p> is not a directory; no user directives` is printed by `directives` and `brief` (`megamaid.py:348`), not by `config`. Warnings go to stderr; the exit code stays 0.

## Keys in `config/defaults.json`

| Key | Default | Meaning |
|---|---|---|
| `paths.reviews` | `docs/megamaid/reviews` | where review reports and their usage ledgers land |
| `paths.plans` | `docs/megamaid/plans` | where plan folders land |
| `paths.patterns` | `docs/megamaid/PATTERNS.md` | the PATTERNS manifest; `null` disables manifest use in review, plan and fix |
| `paths.base_branch` | `main` | default base for diffs |
| `directives.include_plugin_defaults` | `true` | `false` stops loading `<plugin root>/directives/*.md` |
| `directives.user_path` | `docs/directives` | directory of the project's own directive `.md` files, relative to the project root |
| `agents.<role>` | nine roles | `{subagent_type, when_to_use}`; see below |
| `fix.commit_per_item` | `true` | fix commits each item on reviewer PASS |
| `fix.model_invocation` | `false` | `true` lets a natural-language request start the fix workflow through the model-only `fix-auto` skill |
| `models.review` | `opus` | model for review palette agents |
| `models.plan` | `opus` | model for the planner |
| `models.patterns` | `opus` | model for the pattern scanner and shaver |
| `models.fix.implementer_standard` | `opus` | implementer for a standard fix item |
| `models.fix.implementer_trivial` | `sonnet` | implementer for a trivial fix item |
| `models.fix.reviewer` | `opus` | the fix reviewer |
| `models.vacu_suck` | `opus` | replaces every review, plan and fix lane in a sweep; `models.patterns` untouched |

The nine default roles: `code-reviewer`, `simplifier`, `silent-failure-hunter`, `test-auditor`, `consistency-auditor`, `implementer`, `planner`, `pattern-scanner`, `pattern-shaver`, each with `subagent_type: megamaid:<role>` (`config/defaults.json:12-49`). Paths are relative to the project root.

## Keys absent by default

| Key | Values | Effect |
|---|---|---|
| `effort.<lane>` | `low`, `medium`, `high`, `xhigh`, `max` | effort for a lane; the `effort` tree mirrors `models` key for key (`effort.review`, `effort.fix.reviewer`, `effort.vacu_suck`, …). Absent: no `effort` is passed, the session default applies. Needs a Claude Code whose Agent call takes `effort`; the version is in the [README](../../README.md) and `skills/configure/SKILL.md:69` |
| `agents.<role>.model` | `sonnet`, `opus`, `haiku`, `fable` | per-role model |
| `agents.<role>.effort` | the five effort values | per-role effort |

Model values are the Agent call's enum (`skills/configure/SKILL.md:79`); the scripts pass any string through. Effort is validated at `resolve`: a sixth value exits 2 (`megamaid.py:116,319-320`).

Resolution (`megamaid.py:296-322`): per-role beats lane. Model: `agents.<role>.model`, else `models.vacu_suck` under `--coerce vacu_suck`, else `models.<lane>`. Effort: `agents.<role>.effort`, else `effort.vacu_suck` under coercion when set, else `effort.<lane>`, else `unset`.

Roles: `agents.<role>: null` removes a role (merge semantics). A new role needs `subagent_type` and `when_to_use`; one with `subagent_type` other than `megamaid:` + a shipped agent name is foreign and gets the authority sentence and a `Your lens:` line from `when_to_use` in its run brief (`megamaid.py:476-480`). Removing `planner` or `implementer` makes plan and fix fail at `resolve` with exit 2.

## Migration from the earlier plugin

`megamaid.py config` prints, on stderr after any `warning:` lines and before the stdout JSON, one `notice:` line per earlier-install file it does not read (`migrate.py:106-116`). The exit code is unchanged. Notices come only from `config`, never from `resolve`, `directives` or `brief`.

| Notice | When |
|---|---|
| `notice: <dir>/.claude/<earlier config> is not read; run /megamaid:configure to migrate it` | the earlier config exists at that layer and no `megamaid.config.json` exists beside it (any such file silences it, even an empty `{}`) |
| `notice: PATTERNS manifest at <path> is not read; run /megamaid:configure to move or copy it` | the earlier manifest (its default path, or the `paths.patterns` of the earlier config layers) is a file, megamaid's `paths.patterns` is a string, and `<project>/<paths.patterns>` does not exist |

Layer directories are realpaths; home and project that are the same directory by inode give one notice set (`migrate.py:47-51`).

`migrate config --layer home|project` reads that layer's earlier config and prints the translation on stdout (JSON, indent 2, input order); it writes nothing. The configure skill writes the file after the user confirms. Rules (`migrate.py:143-164`), in key order of the input:

| Input key | Rule |
|---|---|
| `agents` | copied as is; a `subagent_type` with the earlier plugin's prefix is renamed to `megamaid:…` (`migrate.py:135-140`); `null` roles, incomplete roles and `when_to_use` text pass through untouched |
| `models`, `effort` | the earlier plugin's sweep lane renamed to `vacu_suck`; lanes kept only where `models.<lane>` exists in defaults; a non-object `effort` is dropped, a non-object `models` copied as is |
| any other key in defaults | kept only along dotted paths that exist in defaults; a leaf (including `null`) is copied as is; an object emptied by dropping is omitted and only its dropped children reported |
| any other key | dropped |

Each dropped path prints `dropped: <dotted.key>` on stderr. Exit 2: `<path>: missing`, `invalid JSON in <path>: <msg>` (`not UTF-8 text` for a non-UTF-8 file), `<path>: top level is not an object`.

`migrate manifest --move|--copy` (`migrate.py:167-203`): source is the earlier manifest's realpath (directory resolved, the file itself not); target is `<project>/<paths.patterns>`. Creates parent directories; never runs git; never overwrites. `--copy` copies with metadata. `--move` renames, copies then unlinks across devices, and for a symlinked source copies the link's content and removes the link so the shared file stays. Prints `moved|copied <src> -> <dst>`. Exit 2: `no PATTERNS manifest from an earlier install`, `paths.patterns is disabled`, `<dst> exists; not overwritten`, or `<path>: <os error>` with no second copy left behind.

See [../features/usage-ledger.md](../features/usage-ledger.md) for what the model and effort choices cost, and [../architecture/design-rules.md](../architecture/design-rules.md) for why the scripts, not the skills, resolve these.
