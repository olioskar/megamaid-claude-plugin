# Phase 0: megamaid identity — design

Date: 2026-10-12. Phase 0 of `docs/handover/plan.md`. Revision 3, after two two-lens review rounds (`docs/megamaid/reviews/2026-10-12-phase0-spec-review.md`, `…-round2.md`).

## Goal

The fork becomes its own plugin, `megamaid`. Every comb identity is renamed and versioning restarts at 0.1.0. The review → plan → fix pipeline does not change. configure and patterns gain migration steps, so a project's existing comb config and comb PATTERNS manifest can be carried over. Hooks and mods start in Phase 1.

## Decisions

| Question | Decision |
|---|---|
| User-facing names | `megamaid` everywhere (name map below). |
| `the-desert` | Renamed to `vacu-suck`. No alias, no second skill. |
| Read a comb config when no megamaid config exists? | Never read. A notice names it, and `/megamaid:configure` offers to migrate it. |
| Existing comb output in `docs/combs/` | Reports and plans: a README migration line only. The comb PATTERNS manifest: a notice, plus an offer to move or copy it from configure and from patterns (one shared block). |
| Repeating notice | Intended. It stops once a `megamaid.config.json` exists at that layer; the README says an empty `{}` file silences it. |
| comb and megamaid both installed | A README note only. |
| Tracked `PLAYBOOK.md` | `docs/handover/PLAYBOOK.md` replaces it at the root; the handover copy is deleted. |
| CHANGELOG | comb's history is dropped; a single 0.1.0 entry links to comb's CHANGELOG. `## [Unreleased]` stays. |
| Eval suite | Not run in Phase 0. This is a deliberate exception to the eval cadence: the new behaviour is in the script and pinned by fixtures, and no eval case covers configure or patterns. The full suite runs in Phase 1. |
| `smoke.sh` | Run once before the PR. It is not added to the release gate. Its wording is corrected (it calls `claude -p`). |
| comb-name guard | Permanent. Exempt: a fixed path list, plus lines that carry comb's repo URL. |
| Review trigger "comb through changes" | Removed, with no replacement. |
| LICENSE holder | `Olafur O. Egilsson`. |

comb's repo URL, used wherever comb is linked: `https://github.com/olioskar/comb-the-desert-claude-plugin` (below: `<comb URL>`).

## Name map

| comb | megamaid |
|---|---|
| `plugin.json` `name: comb`, `displayName: "Comb the Desert"` | `megamaid`, `"Megamaid"` |
| `plugin.json` `description: "Comb the Desert: a review → plan → fix pipeline …"` | `"megamaid: a review → plan → fix pipeline for code review with configurable agents and authoritative project directives."` |
| `homepage`, `repository` | `https://github.com/olioskar/megamaid-claude-plugin` |
| `LICENSE` `Copyright (c) 2026 Olafur Oskarsson` | `Copyright (c) 2026 Olafur O. Egilsson` (matches `plugin.json` `author.name`) |
| `version: 0.15.3`, README Status line | `0.1.0`, in the release task only |
| `/comb:<skill>` (review, plan, fix, fix-auto, patterns, configure, help) | `/megamaid:<skill>` |
| `/comb:the-desert`, `skills/the-desert/` | `/megamaid:vacu-suck`, `skills/vacu-suck/` |
| status lines `[the-desert] Complete …` | `[vacu-suck] Complete …` |
| `models.the_desert`, `effort.the_desert`, `--coerce the_desert` | `models.vacu_suck`, `effort.vacu_suck`, `--coerce vacu_suck` |
| `comb:<agent>` subagent types (8), the native prefix in `comb.py` `is_native` | `megamaid:<agent>`, the prefix `"megamaid:"` |
| `comb.config.json` (home and project layers) | `megamaid.config.json` at the same two places |
| `docs/combs/reviews`, `docs/combs/plans`, `docs/combs/PATTERNS.md` (and `docs/combs/TEMPLATE.md`, `ANCHORS.md` in `test-manifest.sh`) | `docs/megamaid/…` |
| `.comb/` (excerpts, briefs, `.gitignore`), written by both `comb.py` and `manifest.py` | `.megamaid/` |
| function `comb_dir()` in `comb.py` and `manifest.py` | `state_dir()` |
| `scripts/comb.py`, `scripts/test-comb.sh`, `scripts/fixtures/comb/` | `scripts/megamaid.py`, `scripts/test-megamaid.sh`, `scripts/fixtures/megamaid/` |
| error prefix `comb.py:`, brief header `# comb brief —`, manifest banner `> comb excerpt of …`, hint `/comb:patterns --shave` | `megamaid.py:`, `# megamaid brief —`, `> megamaid excerpt of …`, `/megamaid:patterns --shave` |
| help overview header `comb-the-desert — code-review pipeline for Claude Code` | `megamaid — code-review pipeline for Claude Code` |
| PATTERNS manifest header `comb version:` (no script parses it) | `megamaid version:` |
| test temp prefixes `comb-test.`, the `"comb test"` commit identity, `"comb eval"` in scaffolds | `megamaid-test.`, `"megamaid test"`, `"megamaid eval"` |
| "comb" as the product name in prose | "megamaid" |
| comb version citations in megamaid docs (help `SKILL.md:292` "since 0.15.0"; `evals/README.md` v0.9.0–0.15.0) | help: the version clause is removed. `evals/README.md`: a lineage header (see below). |

**vacu-suck opening.** `skills/the-desert/SKILL.md:15` currently reads: "You're running the full comb pipeline as one continuous sweep. No pauses …, and no item skipped except one the planner could not reproduce. You comb the desert until it's clean." It becomes: "Commence Operation Vacu-Suck: review the code, plan the fixes, apply them. No pauses between steps, no confirmations requested, and no item skipped except one the planner could not reproduce." The rule sentence in the middle stays word for word.

**Lineage headers.** `experiments/README.md` and `evals/README.md` each get one header line: "Results and version numbers below were recorded on [comb](<comb URL>); command and file names are updated to megamaid."

Unchanged: agent names, skill names other than `the-desert`, config keys other than `the_desert`, the review and plan file formats, the README Requirements section, and all review → plan → fix behaviour. The words `combine`, `combined` and `combining` stay as they are.

## comb-name guard

Task 1 adds a numbered section to `scripts/check-contract.sh`, which already runs in the release gate and in CI.

- **Pattern.** Two greps that together form the pattern: `-iwE 'comb|combs|the-desert|the_desert'` and `-iF 'comb_'`. `-w` is used instead of `\b` because it is portable across the macOS and Linux greps. In the script, the pattern is assembled from fragments (for example `w='co''mb'`), so the guard's own lines don't match it and `check-contract.sh` needs no exemption.
- **Scope.** Contents: `git grep` over tracked files. Paths: `git ls-files | grep` with the same two patterns. `docs/` is gitignored, so it is out of scope. Untracked files are not scanned, because the gate runs on committed trees.
- **Exempt paths**, for both the content and the path check: `CHANGELOG.md`, `scripts/migrate.py`, `scripts/fixtures/migrate/` (fixture inputs and their expected outputs).
- **Exempt lines:** any line containing `<comb URL>`. So any mention of comb outside the exempt paths links to comb. That covers the README lineage, coexistence and migration lines, and the lineage headers.
- **Fails closed** (PLAYBOOK "Guards fail closed"):
  - If `git grep` exits above 1, or `git ls-files` prints nothing or fails, the guard prints `FAIL: comb guard could not run` and fails.
  - A check-contract fixture or self-test shows this failing before the guard is added.
- **Output:** one `FAIL: comb identifier at <file>:<line>` (or `<path>` for a name) per hit, and the script fails.
- **Switch:** `GUARD=off` skips only this section and prints `guard: skipped`.
- **Lifecycle:** it fails first (about 146 files), passes from task 9 on, and stays after Phase 0.
- **"Green" between tasks (2–8):** `GUARD=off bash scripts/check-contract.sh` exits 0, and `claude plugin validate .` passes.

## Rename order

Each task leaves the tree green, as defined above. Each moves an identifier together with every gate needle, fixture, grader and trace that matches it. **Expected outputs** (`scripts/fixtures/*/expected/`, `scripts/fixtures/expected/`) that change in any task are regenerated by running the script (`test-*.sh --update` where it exists) and reviewing the diff. They are never edited by hand.

1. **Guard.**
2. **Plugin identity and slash commands.**
   - `plugin.json`: name, displayName, description, homepage and repository (not `version`). The `LICENSE` holder.
   - Every `/comb:<skill>` → `/megamaid:<skill>`, except the `manifest.py` hint, which is done in task 5. This covers:
     - skills, shared, agents, directives, and the `when_to_use` strings in defaults;
     - README;
     - `smoke.sh`;
     - eval and experiment prompts and graders;
     - fixtures (`scripts/fixtures/curated.md` and others);
     - `scripts/fixtures/replay/*/trace.jsonl`, with the `test-replay.sh` expectations.
   - The help overview header, with `smoke.sh:17` and the `help-overview` grader.
   - `/comb:the-desert` becomes `/megamaid:the-desert` here. It gets its final name in task 6.
3. **Agent types.**
   - `comb:<agent>` → `megamaid:<agent>` in `config/defaults.json`, agents, skills (including `comb:*` in plan `SKILL.md`), shared, evals, experiments and fixtures.
   - In `check-contract.sh`: section 8, lines 122–145, including `startswith("comb:")`, `${t#comb:}`, and the negative check ``- `comb:`` at line 142.
   - The native prefix in `comb.py` `is_native` and its docstring.
4. **Helper script.**
   - `comb.py` → `megamaid.py`, `test-comb.sh` → `test-megamaid.sh`, `fixtures/comb/` → `fixtures/megamaid/`.
   - Every call site and check-contract needle (`megamaid.py" config`, and so on).
   - The error prefix, the brief header, and the CLI `prog` and docstring.
   - `comb_dir` → `state_dir` in both scripts.
5. **Paths.**
   - Every `comb.config.json` → `megamaid.config.json`: `megamaid.py`, `shared/config-loading.md`, configure, fix-auto, help, README, and the scaffolds that write it (`evals/config-null-delete`, `dispatch-delivery`, `fix-auto-on`; `experiments/effort-high`, `effort-medium`).
   - `docs/combs` → `docs/megamaid` in defaults, skills, shared, fixtures, evals, `test-manifest.sh` and `test-replay.sh:28`.
   - `.comb/` → `.megamaid/` in **both** `megamaid.py` and `manifest.py` in the same commit, with the manifest banner and the `/comb:patterns --shave` hint, and in the test scripts.
6. **vacu-suck.**
   - The skill folder, frontmatter and opening (see the name map), and the status lines.
   - Config keys in `defaults.json` and, in the same commit, in help `SKILL.md` (`models.the_desert (default: opus)`; check-contract section 9 compares the two).
   - configure, `--coerce`, the check-contract needle at line 95, fixtures, and every cross-reference.
7. **Prose and stragglers.**
   - The product name across skills, shared, agents, directives, evals and experiments.
   - The lineage headers.
   - The `megamaid version:` manifest header (patterns skill, scanner agent, `scripts/fixtures/template.md`).
   - Test temp prefixes and the commit identity, `"megamaid eval"` in scaffolds, the help clause "isn't a comb command".
   - The help version clause is removed, and so is the trigger phrase.
   - The `smoke.sh` header and the README Development line are reworded to say smoke calls `claude -p`.
8. **comb migration** (below), test first.
9. **Docs** (below). The guard passes from this task on.
10. **Release.** The CHANGELOG entry, `version` and the README Status line, in one commit.

The plan may merge adjacent tasks if one can't be green on its own. Every deviation is recorded in the ledger.

## Migration from comb

### Module

`scripts/migrate.py` holds every comb-facing constant and rule: comb's config file name, the default manifest path `docs/combs/PATTERNS.md`, and the key and type translations.
- `megamaid.py` loads it by file path (`importlib.util.spec_from_file_location`), because `python3 -I` drops the script's directory from `sys.path`.
- If loading fails, `config` and `migrate` exit 2 with `megamaid.py: cannot load scripts/migrate.py: <error>`. A fixture covers this, with `--plugin-root` pointing at a copy without the file.
- `megamaid.py` itself never names comb.

### Notices

- **Who prints them:** only `megamaid.py config`, never `resolve`, `directives` or `brief`.
- **Format and timing:** they go to stderr, before the stdout JSON and after any `warning:` lines. The layer directory is resolved with realpath and `.claude/<file>` is appended unresolved, so a symlinked `.claude` still reads as its layer; a manifest path has its directory resolved but not the file. They do not change the exit code. (Revised after the branch review.)
- **They never fail `config`.** A comb file that is unreadable, invalid or not an object still gets its notice when it exists, and is otherwise ignored.

The two notices:

- **Config:** for each layer (home first, then project) that has a comb config file but no `megamaid.config.json`:
  `notice: <path> is not read; run /megamaid:configure to migrate it`
  If home and project are the same directory (compared by inode, so case-only spellings on a case-insensitive disk count as one), the line is printed once, under the project directory. If both files exist at a layer, nothing is printed.
- **Manifest:** comb's manifest path is comb's merged `paths.patterns`: the comb config layers that parse as objects, merged over `docs/combs/PATTERNS.md`. A relative path resolves against the project root. The check is skipped if that value is `null` or not a string. When the file exists, and megamaid's resolved `paths.patterns` is a string whose file does not exist:
  `notice: PATTERNS manifest at <path> is not read; run /megamaid:configure to move or copy it`

`shared/config-loading.md` gains: "`notice:` lines name a file from an earlier install that is not read. Pass them on to the user in your final report and carry on, unless your skill says how to act on them (configure, patterns)."

### Shared block: `shared/manifest-migration.md`

This is the single source for the manifest offer, used by configure and patterns. It covers:
- asking move / copy / skip;
- running `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" migrate manifest --move|--copy`;
- showing its output, or its error and stopping the offer.

It refers only to "the manifest named in the notice" and never says comb. patterns runs the block right after Step 1, before any recon (revised after the branch review; it was Step 4), and before the `--shave` "No manifest" stop. Once a move or copy succeeds, both flows continue against the migrated manifest.

### `megamaid.py migrate`

```
megamaid.py migrate config --layer home|project [--plugin-root P] [--home H] [--project-root R]
megamaid.py migrate manifest --move|--copy [--plugin-root P] [--home H] [--project-root R]
```

Both use the same flag parser and defaults as `config`.

**`migrate config`** reads that layer's comb config, which may start with a BOM.
- **stdout:** the translated config as JSON, indented by 2, in input key order.
- **stderr:** one `dropped: <dotted.key>` per dropped key, naming the top-most dropped key, in input order.
- **exit 2:**
  - `megamaid.py: <path>: missing`;
  - `megamaid.py: invalid JSON in <path>: <msg>`;
  - `megamaid.py: <path>: top level is not an object`.

Rules, applied in this order to each top-level key and then downward:
1. **`agents`.** If it is an object, every role is copied as it is, including custom, invalid and `null` roles. The only change: a `subagent_type` string beginning `comb:` becomes `megamaid:`. `when_to_use` text is never changed. If `agents` is not an object, it is copied as it is (`config` warns about it later, as usual).
2. **`effort`.** `effort.the_desert` → `effort.vacu_suck`. `effort.<lane>` is kept when `models.<lane>` exists in the plugin's defaults (after the rename). Other `effort` keys are dropped.
3. **`models.the_desert`** → `models.vacu_suck`.
4. **Everything else.**
   - A key is kept when its dotted path exists in the plugin's `config/defaults.json` at run time, with leaves checked individually (`models.fix.unknown` is dropped).
   - A value of `null` at a kept path is copied. At a dropped path it is dropped.
   - Where defaults has a leaf but comb has an object (or the reverse), the value is copied as it is.
   - An object left empty after dropping is omitted, and only its dropped children are reported.
5. **Values** are copied as they are, path values included.

**`migrate manifest`** copies or moves comb's manifest, resolved as for the notice, to megamaid's resolved `paths.patterns`.
- **exit 0:** prints `moved <src> -> <dst>` or `copied <src> -> <dst>`, with realpath'd absolute paths. It creates parent directories.
- **exit 2:**
  - `megamaid.py: no PATTERNS manifest from an earlier install` (the source is missing, `null` or not a string);
  - `megamaid.py: paths.patterns is disabled` (megamaid's value is `null` or not a string);
  - `megamaid.py: <dst> exists; not overwritten`.
- It is a plain filesystem operation: it never runs git and never commits.

### Configure skill

When `config` printed notices, configure handles them before the user's request:

- **Config notice:** for each layer in printed order ("global" in configure = `--layer home`):
  - run `migrate config --layer <layer>`;
  - show the JSON and the dropped keys;
  - on yes, write `megamaid.config.json` at that layer. Its Step 5 formatting rule (2-space indent, configure's key order) applies to the written file; the script's output order is not kept.
- **Re-check:** after any config migration, re-run `config` before acting on a manifest notice.
- **Manifest notice:** run `shared/manifest-migration.md`.
- **Never** change or delete the comb config.
- **Then** carry on with the original request.

`check-contract.sh` gains needles that configure and patterns reference `shared/manifest-migration.md`, and that configure invokes `megamaid.py" migrate config`.

### Fixtures and tests

All migration inputs and expected outputs live in `scripts/fixtures/migrate/`. That covers comb-named files such as `home/.claude/comb.config.json` and outputs that contain comb paths. `test-megamaid.sh` runs these cases with a second output directory, diffs them against `scripts/fixtures/migrate/expected/`, and supports `--update`. Case names never contain comb identifiers. `migrate manifest` cases run on a temp copy of the fixture project.

Cases:
- **Notices:**
  - a comb config only at home, and only in the project;
  - both files at one layer;
  - a comb config at home with a megamaid config in the project;
  - home equal to the project root;
  - an invalid comb config during `config`, which still gets its notice and does not fail;
  - the manifest at comb's default path, and at a comb-configured path;
  - comb `paths.patterns: null`;
  - megamaid `paths.patterns: null`;
  - `migrate.py` missing.
- **`migrate config`:**
  - `models.the_desert` and `effort.the_desert`;
  - a `comb:` type, and a custom `acme:` role;
  - an unknown leaf, and an unknown `effort` lane;
  - `null` at kept and dropped paths;
  - a BOM, invalid JSON, a non-object top level, a missing file;
  - `--layer project` when home equals the project root.
- **`migrate manifest`:** move, copy, existing target, missing source.

## Docs (task 9)

- **README:**
  - The title is `megamaid` and every name is swapped.
  - **Lineage:** "Forked from [comb](<comb URL>) 0.15.3. From Phase 1 megamaid moves comb's rules into a hooks module and will require a mod-capable Claude Code; comb stays for builds without mods."
  - **Coexistence:** "With [comb](<comb URL>) also installed, both plugins' model-invocable skills trigger on the same phrases; install one, or use explicit `/megamaid:*` commands."
  - **Migration:** "Coming from [comb](<comb URL>)? `/megamaid:configure` migrates its config and PATTERNS manifest; move old reports with `git mv docs/combs docs/megamaid`. An empty `{}` `megamaid.config.json` silences the config notice."
  - Install covers `--plugin-dir` only. The marketplace line comes in Phase 7.
  - The Requirements section is unchanged.
- **PLAYBOOK:** `docs/handover/PLAYBOOK.md` replaces the root `PLAYBOOK.md`.
  - Its `docs/combs/reviews` line becomes `docs/megamaid/reviews`.
  - "Session continuity" and "Where things live" say the playbook is at the root, and list `scripts/migrate.py` and `shared/manifest-migration.md`.
  - "Release gate" notes that `smoke.sh` runs once before a PR and calls `claude -p`.
- **Outside git** (edited, not committed):
  - Delete `docs/handover/PLAYBOOK.md`.
  - `plan.md` Phase 0 "Done when": "the free gates pass under the new name; smoke.sh passes once; no eval run (deliberate exception, see ledger)".
  - `plan.md` Phase 1 "Done when" adds: "the full eval suite runs and is compared with comb v0.15.0's results".
  - `plan.md:49`: "fix / the-desert pane" → "fix / vacu-suck pane".
  - `plan.md` Phase 1 adds one sentence: hooks key on `megamaid:<agent>` types and the megamaid skill names fixed in Phase 0.
  - `megamaid-dev.md` is rewritten. State: Phase 0 done, on its branch. Next: Phase 1 spec. Decisions: `/megamaid:vacu-suck`, `megamaid.py migrate config|manifest`, guard, root PLAYBOOK. It drops the `import-comb` wording.
  - Memory: update `project_megamaid.md` and its `MEMORY.md` index line to point to the root `PLAYBOOK.md` plus `docs/handover/` (plan, ledger, state), and update `feedback_eval_cadence.md` to say "the eval suite (comb, now megamaid)".
  - Ledger lines: the Phase 0 eval exception, the trigger removal, and the smoke decision.

## Release (task 10)

- **CHANGELOG:**
  - comb's entries are removed, and `## [Unreleased]` stays.
  - One `## [0.1.0] — <release date>` entry: forked from comb 0.15.3, with a link to `<comb URL>/blob/main/CHANGELOG.md`.
  - Changed: the name map, `vacu-suck`, the config file name, `docs/megamaid/`, `.megamaid/`.
  - Added: the migration notices, `megamaid.py migrate`, `shared/manifest-migration.md`, the comb-name guard.
- **Version:** `version` 0.1.0 and the README Status line, in the same commit: `docs(release): v0.1.0 — megamaid identity`.
- **Process:**
  - Branch `feat/v0.1.0-identity`, one commit per task.
  - Push on the maintainer's go, then open the PR. The maintainer merges.

## Done when

1. Free gates pass: `claude plugin validate .`, and `scripts/check-contract.sh` with the guard on (it runs `test-megamaid.sh`, `test-manifest.sh`, `test-replay.sh`).
2. `scripts/smoke.sh` passes once, before the PR (two short `claude -p` calls; a few cents).
3. Independent reviewers check the branch before the PR, in two lenses: the contract, and scripts plus tests.

No eval run (see Decisions). The last full suite run was comb v0.15.0: 6/8, and both misses were grader shape, fixed and replayed offline. Since then, 0.15.1 trimmed prose, 0.15.2 removed agent passages that were checked by two-arm experiments, and 0.15.3 changed docs.

**Known gap:** most renamed graders don't run until Phase 1's full run. `test-replay.sh` does replay the `noncode-shortcircuit` and `fix-reviewer-diff-scope` graders offline against renamed traces. The grader regexes that match command, agent or path names are checked by hand in the scripts-and-tests review.
