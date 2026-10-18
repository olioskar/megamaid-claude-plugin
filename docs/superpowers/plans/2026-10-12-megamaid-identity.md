# megamaid identity (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the comb 0.15.3 fork to `megamaid` 0.1.0, add a permanent guard against leftover comb names, and add migration of a comb config and PATTERNS manifest.

**Architecture:** First a guard in `scripts/check-contract.sh` that fails while any comb identifier is left. Then one commit per renamed surface, each leaving the other gates green. Then a `scripts/migrate.py` module (the only code that names comb), loaded by `megamaid.py`, with `config` notices and `migrate config|manifest` subcommands. Then the skill prose, the docs, and the release.

**Tech Stack:** bash, Python 3.8+ stdlib, git, perl (for mechanical renames), Claude Code plugin layout.

**Spec:** `docs/superpowers/specs/2026-10-12-megamaid-identity-design.md` (revision 3). Read it before starting; this plan argues from it.

## Global Constraints

- comb's repo URL, wherever comb is linked: `https://github.com/olioskar/comb-the-desert-claude-plugin`.
- No behaviour change to review → plan → fix. Only configure and patterns gain migration steps.
- Branch `feat/v0.1.0-identity`. One commit per task, `type(scope): summary`, ending with the session's Co-Authored-By trailer. Never push. The maintainer gives the go for push.
- "Green" during tasks 2–9: `GUARD=off bash scripts/check-contract.sh` exits 0 and `claude plugin validate .` passes. From task 10 on: `bash scripts/check-contract.sh` exits 0 with the guard on.
- Expected outputs (`scripts/fixtures/*/expected/`, `scripts/fixtures/expected/`) are regenerated with `bash scripts/test-<x>.sh --update` and the diff is reviewed. They are never edited by hand.
- Mechanical renames touch only tracked text files that match, and never `CHANGELOG.md` or the root `PLAYBOOK.md` (both are replaced later). The file selector, used below as `$SEL`:
  `git grep -lzI -E '<pattern>' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md'`
- Use `git grep -E` without `\b`: this machine's git does not support `\b`. perl's `\b` is fine.
- Nothing is run that costs money, except `scripts/smoke.sh` once, in Task 11.
- Exempt from the guard: `CHANGELOG.md`, `scripts/migrate.py`, `scripts/fixtures/migrate/`, and any line containing comb's repo URL.

## Review Focus

1. **Fresh Linux CI checkout.** The guard must behave identically under GNU grep, with `-w` on `the-desert` and `comb_`, and must fail closed. Pinned by the guard self-tests in Task 1 (identifier hit, word-boundary non-hit, `_` form, `the-desert`, a file-name hit, the exempt path, the URL skip, fail-closed), which run inside `check-contract.sh` in CI.
2. **Home and project are the same directory but reached through different spellings** (the macOS `/tmp` → `/private/tmp` symlink). Expect one notice, not two. Pinned by `notice-same` in Task 8, which passes a symlink to the root as `--home` (so it is exercised on Linux too).
3. **A comb config written by hand with a BOM, or invalid JSON.** `config` must still run and print the notice; `migrate config` must exit 2 with a clear message. Pinned by `notice-invalid`, `translate-bom` and `translate-badjson` in Task 8.
4. **A user who migrated their config and kept `paths.patterns` pointing at the comb manifest.** There must be no manifest notice, and `migrate manifest` must not overwrite it. Pinned by `notice-kept-path` and `manifest-copy-again` in Task 8.
5. **A move whose target parent directory doesn't exist yet.** It must be created. Pinned by `manifest-move` in Task 8, where `docs/megamaid/` does not exist in the layout.

## Deviations from the spec (record each in the ledger at execution)

- **The `/comb:patterns --shave` hint** in `manifest.py` is renamed in Task 2 together with every other `/comb:<skill>`, not in task 5. One rule ("every `/comb:<skill>`") is simpler to apply and check than an exception.
- **`comb-the-desert` and `Comb the Desert`** are renamed in Task 2. Task 6's `the-desert` → `vacu-suck` would otherwise turn `comb-the-desert` into `comb-vacu-suck`.
- **The `migrate.py` load-failure fixture** copies `megamaid.py` alone into a temp directory, instead of using a `--plugin-root` without the file. `migrate.py` is loaded from next to `megamaid.py`, not from `--plugin-root`, because the test fixtures use a fixture plugin root that has no `scripts/`.
- **`GUARD=off` skips the repo scan only; the guard's self-tests still run.** They don't scan the repo, so the green check stays meaningful, and every green check also re-verifies the guard code.
- **The spec's task 8 is split** into Task 8 (script and fixtures) and Task 9 (skill prose and needles). As a result, spec tasks 9 and 10 become Tasks 10 and 11.

---

### Task 1: Name guard

**Files:**
- Modify: `scripts/check-contract.sh` (new section 10, before the final `if [ "$fail" -eq 0 ]`)

**Interfaces:**
- Produces: the bash function `name_guard <dir>`. It prints `FAIL: comb identifier at <file>:<line>` or `… at <path>` for each hit, or `FAIL: comb guard could not run`, and returns 1 on any of those. The env switch is `GUARD=off`. Later tasks use `GUARD=off bash scripts/check-contract.sh` as their green check.

- [ ] **Step 0: Branch and baseline**

```bash
git switch -c feat/v0.1.0-identity
claude plugin validate . && bash scripts/check-contract.sh
```
Expected: both pass (`check-contract: OK`). If not, stop and report: the baseline is broken.

- [ ] **Step 1: Write the failing self-tests**

Insert before the final `if [ "$fail" -eq 0 ]; then` block in `scripts/check-contract.sh`:

```bash
# 10. Old-name guard self-tests: the guard fails closed outside a repo and reports exactly the
#     identifier line in a scratch repo (a word-boundary match, not a substring).
w='co''mb'
gt=$(mktemp -d "${TMPDIR:-/tmp}/guard.XXXXXX")
# `|| true` inside the group: under `set -o pipefail` the pipeline would otherwise take name_guard's exit 1.
if ! { name_guard "$gt" 2>/dev/null || true; } | grep -qF "guard could not run"; then
  echo "FAIL: name guard does not fail closed outside a git repo"; fail=1
fi
git -C "$gt" init -q && mkdir -p "$gt/scripts" \
 && printf 'see %s.py here\nsee %sined here\nx %s_dir\ny the-%s z\nhttps://%s\n' "$w" "$w" "$w" desert "$GUARD_URL" > "$gt/a.md" \
 && printf '%s\n' "$w" > "$gt/scripts/migrate.py" && : > "$gt/$w-x.txt" && git -C "$gt" add -A
gout=$(name_guard "$gt" 2>&1)
want=$(printf 'FAIL: %s identifier at %s\n' "$w" "$w-x.txt" "$w" a.md:1 "$w" a.md:3 "$w" a.md:4)
[ "$gout" = "$want" ] || { echo "FAIL: name guard self-test: expected:"; echo "$want"; echo "got: $gout"; fail=1; }
rm -rf "$gt"
```

- [ ] **Step 2: Run it to see it fail**

Run: `bash scripts/check-contract.sh`
Expected: `FAIL: name guard does not fail closed outside a git repo` and `FAIL: name guard self-test …` (`name_guard: command not found`), and a non-zero exit. (The self-test block references `$GUARD_URL`, defined in Step 3; it is empty here, which is fine for a failing run.)

- [ ] **Step 3: Implement the guard**

Insert directly above the self-tests (same section 10):

```bash
# 10. Old-name guard: no identifier of the plugin this one was forked from, in tracked file
#     contents or paths. Exempt: CHANGELOG.md, scripts/migrate.py, scripts/fixtures/migrate/, and
#     any line carrying the old repo URL. The pattern is built from fragments so this section does
#     not match itself. GUARD=off skips the repo scan (the self-tests still run).
w='co''mb'
GUARD_WORDS="$w|${w}s|the-""desert|the_""desert"
GUARD_FIXED="${w}_"
GUARD_URL="github.com/olioskar/${w}-the-""desert-claude-plugin"
GUARD_EXEMPT='^(CHANGELOG\.md|scripts/migrate\.py|scripts/fixtures/migrate/)'
name_guard() {
  local dir=$1 files a b rc line f rest n out=0
  files=$(git -C "$dir" ls-files 2>/dev/null) || { echo "FAIL: $w guard could not run"; return 1; }
  [ -n "$files" ] || { echo "FAIL: $w guard could not run"; return 1; }
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [[ "$f" =~ $GUARD_EXEMPT ]] && continue
    echo "FAIL: $w identifier at $f"; out=1
  done < <({ printf '%s\n' "$files" | grep -iwE "$GUARD_WORDS"; printf '%s\n' "$files" | grep -iF "$GUARD_FIXED"; } | sort -u)
  a=$(git -C "$dir" grep -nI -iwE "$GUARD_WORDS" 2>/dev/null); rc=$?
  [ "$rc" -gt 1 ] && { echo "FAIL: $w guard could not run"; return 1; }
  b=$(git -C "$dir" grep -nI -iF "$GUARD_FIXED" 2>/dev/null); rc=$?
  [ "$rc" -gt 1 ] && { echo "FAIL: $w guard could not run"; return 1; }
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    f=${line%%:*}; rest=${line#*:}; n=${rest%%:*}
    [[ "$f" =~ $GUARD_EXEMPT ]] && continue
    [[ "$line" == *"$GUARD_URL"* ]] && continue
    echo "FAIL: $w identifier at $f:$n"; out=1
  done < <(printf '%s\n%s\n' "$a" "$b" | sort -u)
  return $out
}
if [ "${GUARD:-on}" = off ]; then
  echo "guard: skipped"
else
  name_guard . || fail=1
fi
```

Then remove the duplicate `w='co''mb'` line from the self-test block (it is set once, above). The self-test block must stay after the guard definition, because it uses `$GUARD_URL`.

- [ ] **Step 4: Run to verify**

Run: `GUARD=off bash scripts/check-contract.sh`
Expected: `guard: skipped`, then `check-contract: OK`, exit 0. The self-tests pass: the scratch repo yields exactly the four lines in `want` (`<word>-x.txt`, `a.md:1`, `a.md:3`, `a.md:4`), and `a.md:2` (`…ined`), `a.md:5` (URL) and `scripts/migrate.py` (exempt) are not reported.

Run: `bash scripts/check-contract.sh 2>&1 | grep -c 'identifier at'`
Expected: about 710. Then confirm the guard doesn't flag its own section:
`bash scripts/check-contract.sh | grep -F 'at scripts/check-contract.sh:'` may list older lines (line 2's description, the `comb.py` needles), but none at or after the `# 10.` line. Those older hits are renamed in Tasks 3, 4 and 7.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-contract.sh
git commit -m "test(contract): permanent old-name guard, fail-closed, with self-tests"
```

---

### Task 2: Plugin identity and slash commands

**Files:**
- Modify: `.claude-plugin/plugin.json`, `LICENSE`
- Modify (mechanical): every tracked text file matching `/?comb:<skill>`, `comb-the-desert`, or `Comb the Desert` (skills, shared, agents, directives, `config/defaults.json`, README, `scripts/smoke.sh`, `scripts/manifest.py`, `evals/**`, `experiments/**`, `scripts/fixtures/**`, `scripts/test-replay.sh`)
- Regenerate: `scripts/fixtures/expected/*`, `scripts/fixtures/comb/expected/*`

**Interfaces:**
- Consumes: the Task 1 green check.
- Produces: `/megamaid:<skill>` names everywhere, plus `/megamaid:the-desert`, which Task 6 renames.

- [ ] **Step 1: Write the failing check**

Run: `git grep -nE '(^|[^a-z])comb:(review|plan|fix-auto|fix|patterns|configure|help|the-desert)([^a-z-]|$)|comb-the-desert|Comb the Desert' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' | wc -l`
Expected: a non-zero count (this is the check that has to reach 0). Also `grep -c 'Olafur O. Egilsson' LICENSE`: expected `0` (later `1`).

- [ ] **Step 2: Edit plugin.json and LICENSE**

Set `.claude-plugin/plugin.json` to (version untouched):

```json
{
  "name": "megamaid",
  "displayName": "Megamaid",
  "version": "0.15.3",
  "description": "megamaid: a review → plan → fix pipeline for code review with configurable agents and authoritative project directives.",
  "author": {
    "name": "Olafur O. Egilsson",
    "email": "olioskar@gmail.com"
  },
  "homepage": "https://github.com/olioskar/megamaid-claude-plugin",
  "repository": "https://github.com/olioskar/megamaid-claude-plugin",
  "license": "MIT",
  "keywords": [
    "code-review",
    "pr-review",
    "review-pipeline",
    "agents",
    "directives"
  ]
}
```

In `LICENSE`, change `Copyright (c) 2026 Olafur Oskarsson` to `Copyright (c) 2026 Olafur O. Egilsson`.

- [ ] **Step 3: Mechanical rename**

```bash
git grep -lzI -E 'comb:(review|plan|fix-auto|fix|patterns|configure|help|the-desert)|comb-the-desert|Comb the Desert' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' \
 | xargs -0 perl -pi -e '
   s{comb-the-desert-claude-(?:plugin|skill)}{megamaid-claude-plugin}g;
   s{comb-the-desert}{megamaid}g;
   s{Comb the Desert}{Megamaid}g;
   s{(?<![A-Za-z])comb:(review|plan|fix-auto|fix|patterns|configure|help|the-desert)(?![A-Za-z-])}{megamaid:$1}g;
 '
```

Check the help header: `git grep -n 'megamaid — code-review pipeline'` must list `skills/help/SKILL.md`, `scripts/smoke.sh` and `evals/help-overview/graders/overview-header.md` (3 hits).

- [ ] **Step 4: Regenerate expected outputs and run the gates**

```bash
bash scripts/test-manifest.sh --update && bash scripts/test-comb.sh --update
git diff --stat -- scripts/fixtures
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
```
Expected: the fixture diff shows only the renamed strings and the byte or size numbers that follow from them. `check-contract: OK`, and validate passes. Re-run the Step 1 command: expected `0`; `grep -c 'Olafur O. Egilsson' LICENSE`: expected `1`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(identity): plugin megamaid, /megamaid:* commands, LICENSE holder"
```

---

### Task 3: Agent types

**Files:**
- Modify (mechanical): every tracked file matching `comb:<agent>`.
- Modify (plain `comb:` → `megamaid:`): `scripts/check-contract.sh` (section 8, lines ~122–145), `scripts/comb.py` (docstring line ~31, `is_native` line ~227), `shared/dispatch-delivery.md:11`, `skills/configure/SKILL.md:66`, `skills/plan/SKILL.md:214`, `skills/review/SKILL.md:198`.
- Regenerate: `scripts/fixtures/comb/expected/*`.

**Interfaces:**
- Produces: the native rule is `subagent_type == "megamaid:" + <agent name>`. Task 8's `migrate config` rewrites `comb:` → `megamaid:` to match it.

- [ ] **Step 1: Failing check**

Run: `git grep -nE 'comb:' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' | grep -v 'test-comb: OK' | wc -l`
Expected: non-zero.

- [ ] **Step 2: Rename**

```bash
git grep -lzI -E 'comb:(code-reviewer|consistency-auditor|implementer|pattern-scanner|pattern-shaver|silent-failure-hunter|simplifier|test-auditor)' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' \
 | xargs -0 perl -pi -e 's{(?<![A-Za-z])comb:(code-reviewer|consistency-auditor|implementer|pattern-scanner|pattern-shaver|silent-failure-hunter|simplifier|test-auditor)(?![A-Za-z-])}{megamaid:$1}g'
perl -pi -e 's{comb:}{megamaid:}g' scripts/check-contract.sh scripts/comb.py shared/dispatch-delivery.md skills/configure/SKILL.md skills/plan/SKILL.md skills/review/SKILL.md
```
Then confirm that `scripts/check-contract.sh` still contains `startswith("megamaid:")`, `${t#megamaid:}`, `"\"megamaid:$n\""` and ``- \`megamaid:``, and that `scripts/comb.py` has `{"megamaid:" + n for n in native_names(plugin_root)}`.

- [ ] **Step 3: Regenerate and run the gates**

```bash
bash scripts/test-comb.sh --update && git diff --stat -- scripts/fixtures
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
```
Expected: `resolve-*.out` still says `native: yes` for shipped agents. In the diff, no `native:` value flips. Re-run the Step 1 command: expected `0`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(agents): megamaid:<agent> subagent types and native prefix"
```

---

### Task 4: Helper script

**Files:**
- Rename: `scripts/comb.py` → `scripts/megamaid.py`, `scripts/test-comb.sh` → `scripts/test-megamaid.sh`, `scripts/fixtures/comb/` → `scripts/fixtures/megamaid/`
- Modify (mechanical): every tracked file matching `comb.py`, `test-comb`, `fixtures/comb`, `comb_dir`, `# comb brief`, `comb resolver`
- Regenerate: `scripts/fixtures/megamaid/expected/*`, `scripts/fixtures/expected/*`

**Interfaces:**
- Produces: `scripts/megamaid.py` (CLI `prog="megamaid.py"`, error prefix `megamaid.py: `), `scripts/test-megamaid.sh` (variables `S`, `F`, `E`, `P`, `H`, `R`, `C`, `T`, `TR`, `TL`, `OUT`, `UPDATE`, and the `run`/`norm` functions — Task 8 extends them), and `state_dir()` in both scripts.

- [ ] **Step 1: Failing check**

Run: `git grep -nE 'comb\.py|test-comb|fixtures/comb|comb_dir|# comb brief|comb resolver' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' | wc -l`
Expected: non-zero.

- [ ] **Step 2: Move the files**

```bash
git mv scripts/comb.py scripts/megamaid.py
git mv scripts/test-comb.sh scripts/test-megamaid.sh
git mv scripts/fixtures/comb scripts/fixtures/megamaid
```

- [ ] **Step 3: Rename the references**

```bash
git grep -lzI -E 'comb\.py|test-comb|fixtures/comb|comb_dir|# comb brief|comb resolver' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' \
 | xargs -0 perl -pi -e '
   s{\bcomb\.py\b}{megamaid.py}g;
   s{\btest-comb\b}{test-megamaid}g;
   s{fixtures/comb\b}{fixtures/megamaid}g;
   s{\bcomb_dir\b}{state_dir}g;
   s{# comb brief}{# megamaid brief}g;
   s{\bcomb resolver\b}{megamaid resolver}g;
 '
```

- [ ] **Step 4: Regenerate and run the gates**

```bash
bash scripts/test-megamaid.sh --update && bash scripts/test-manifest.sh --update && git diff --stat -- scripts/fixtures
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
```
Expected: the error lines in the expected files now start `megamaid.py:`, and the brief files start `# megamaid brief —`. `check-contract: OK`. Re-run the Step 1 command: expected `0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(scripts): megamaid.py, test-megamaid.sh, state_dir"
```

---

### Task 5: Paths

**Files:**
- Rename: every `scripts/fixtures/megamaid/**/.claude/comb.config.json` → `megamaid.config.json` in the same folder.
- Modify (mechanical): every tracked file matching `comb.config.json`, `docs/combs`, `.comb` (as a directory), or `comb excerpt of`. This includes `scripts/megamaid.py`, `scripts/manifest.py`, `scripts/test-megamaid.sh`, `scripts/test-manifest.sh`, `scripts/test-replay.sh:28`, `config/defaults.json`, `shared/*`, `skills/*` (configure, fix-auto, help, patterns, …), README, and the scaffolds in `evals/config-null-delete`, `evals/dispatch-delivery`, `evals/fix-auto-on`, `experiments/effort-high` and `experiments/effort-medium`.
- Regenerate: all expected outputs.

**Interfaces:**
- Produces: config layers `~/.claude/megamaid.config.json` and `<project>/.claude/megamaid.config.json`, the default paths `docs/megamaid/{reviews,plans,PATTERNS.md}`, and the state dir `.megamaid/` (with `excerpts/` and `.gitignore`).

- [ ] **Step 1: Failing check**

Run: `git grep -nE 'comb\.config\.json|docs/combs|\.comb([/"'"'"' ]|$)|comb excerpt of' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' | wc -l; git ls-files | grep -c 'comb\.config\.json' || true`
Expected: both non-zero.

- [ ] **Step 2: Rename the fixture config files**

```bash
git ls-files -z | grep -z '/\.claude/comb\.config\.json$' | while IFS= read -r -d '' f; do git mv "$f" "${f%comb.config.json}megamaid.config.json"; done
```

- [ ] **Step 3: Rename the references**

```bash
git grep -lzI -E 'comb\.config\.json|docs/combs|\.comb|comb excerpt of' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' \
 | xargs -0 perl -pi -e '
   s{\bcomb\.config\.json\b}{megamaid.config.json}g;
   s{docs/combs\b}{docs/megamaid}g;
   s{(?<![\w.])\.comb(?=[/"\x27\s`)]|$)}{.megamaid}g;
   s{comb excerpt of}{megamaid excerpt of}g;
 '
```
Inspect: `scripts/manifest.py` `state_dir()` now builds `os.path.join(os.getcwd(), ".megamaid")`, and line ~999 builds `".megamaid", "excerpts"`. `scripts/megamaid.py` `state_dir()` and `layer_paths()` use `.megamaid` and `megamaid.config.json`.

- [ ] **Step 4: Regenerate and run the gates**

```bash
bash scripts/test-megamaid.sh --update && bash scripts/test-manifest.sh --update && git diff --stat -- scripts/fixtures
bash scripts/test-replay.sh
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
```
Expected: `test-replay: OK`, and `grep -n 'docs/megamaid/plans' scripts/test-replay.sh` shows the `noncode-shortcircuit` expectation renamed. `check-contract: OK`. Re-run both Step 1 commands: expected `0` and `0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(paths): megamaid.config.json, docs/megamaid/, .megamaid/ in both scripts"
```

---

### Task 6: vacu-suck

**Files:**
- Rename: `skills/the-desert/` → `skills/vacu-suck/`
- Modify (mechanical): every tracked file matching `the-desert` or `the_desert` (frontmatter, `config/defaults.json` `models.the_desert`, help `SKILL.md` `models.the_desert (default: opus)`, configure, `scripts/megamaid.py` `--coerce` choices and docstring, `scripts/check-contract.sh` section 5 skill list, fixture configs, evals, experiments, README)
- Modify (by hand): `skills/vacu-suck/SKILL.md` opening paragraph
- Regenerate: `scripts/fixtures/megamaid/expected/*`

**Interfaces:**
- Produces: `/megamaid:vacu-suck`, `models.vacu_suck`, `effort.vacu_suck`, `resolve --coerce vacu_suck`. Task 8's `migrate config` maps `the_desert` → `vacu_suck`.

- [ ] **Step 1: Failing check**

Run: `git grep -nE 'the-desert|the_desert' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' | wc -l; git ls-files | grep -c the-desert`
Expected: both non-zero.

- [ ] **Step 2: Rename**

```bash
git mv skills/the-desert skills/vacu-suck
git grep -lzI -E 'the-desert|the_desert' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' \
 | xargs -0 perl -pi -e 's{the-desert}{vacu-suck}g; s{the_desert}{vacu_suck}g'
```

- [ ] **Step 3: Opening paragraph**

In `skills/vacu-suck/SKILL.md`, replace the paragraph that starts `You're running the full comb pipeline as one continuous sweep.` with exactly:

```
Commence Operation Vacu-Suck: review the code, plan the fixes, apply them. No pauses between steps, no confirmations requested, and no item skipped except one the planner could not reproduce.
```

- [ ] **Step 4: Regenerate and run the gates**

```bash
bash scripts/test-megamaid.sh --update && git diff --stat -- scripts/fixtures
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
```
Expected: check-contract section 9 passes (help's `models.vacu_suck (default: opus)` matches `defaults.json`), and `resolve-coerce*.out` were produced with `--coerce vacu_suck`. Re-run both Step 1 commands: expected `0` and `0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(vacu-suck): rename the-desert skill, config keys and coerce flag"
```

---

### Task 7: Prose and stragglers

**Files:**
- Modify: every remaining guard hit outside `PLAYBOOK.md`; `skills/review/SKILL.md` (description); `skills/help/SKILL.md` (python3 clause); `scripts/smoke.sh` header; README Development line; `experiments/README.md`, `evals/README.md` (lineage headers)
- Regenerate: `scripts/fixtures/expected/template-*.out` and any other expected output that changes

**Interfaces:**
- Produces: a tree whose only guard hits are in the root `PLAYBOOK.md` (Task 10 replaces it).

- [ ] **Step 1: Failing check**

Run: `bash scripts/check-contract.sh | grep 'identifier at' | grep -v '^FAIL: comb identifier at PLAYBOOK.md' | wc -l`
Expected: non-zero. Also `grep -lF 'recorded on [' evals/README.md experiments/README.md | wc -l`: expected `0` (later `2`). (Note: the guard prints the old name as a word, so `grep 'identifier at'` is the reliable filter.)

- [ ] **Step 2: Targeted edits (exact)**

- `skills/review/SKILL.md` description: `find bugs in a diff, comb through changes, or check` → `find bugs in a diff, or check`.
- `skills/help/SKILL.md` (around lines 292–293). These two lines (the script name is already renamed by Task 4):
  ```
    python3 is required for every comb command since 0.15.0: each
    skill starts with scripts/megamaid.py config and stops if it fails.
  ```
  become:
  ```
    python3 is required for every megamaid command: each skill
    starts with scripts/megamaid.py config and stops if it fails.
  ```
- `skills/help/SKILL.md` overview block (around lines 33–78): Tasks 2 and 6 made the command names longer (`/megamaid:<skill>`, `/megamaid:vacu-suck`). Re-pad the columns so every description starts in the same column again, and change nothing else in the block.
- `scripts/smoke.sh` line 2: `# Offline structural check: runs the structural gates, then two non-interactive help checks.` → `# Structural check plus two short claude -p help runs (a few cents); run once before a PR.`
- README Development: `` `scripts/smoke.sh` is the offline check. `` → `` `scripts/smoke.sh` runs the free gates plus two short `claude -p` help checks (a few cents); run it once before a PR. ``
- First line under the title of `experiments/README.md` and of `evals/README.md` (a new paragraph):
  `Results and version numbers below were recorded on [comb](https://github.com/olioskar/comb-the-desert-claude-plugin); command and file names are updated to megamaid.`

- [ ] **Step 3: Mechanical rename of what's left**

```bash
git grep -lzI -iwE 'comb|combs' -- . ':!CHANGELOG.md' ':!PLAYBOOK.md' \
 | xargs -0 perl -pi -e '
   next if m{github\.com/olioskar/comb-the-desert-claude-plugin};
   s{\bcomb version\b}{megamaid version}g;
   s{\bcomb-test\.}{megamaid-test.}g;
   s{"comb test"}{"megamaid test"}g;
   s{\bcomb eval\b}{megamaid eval}g;
   s{\bComb\b}{Megamaid}g;
   s{\bcomb\b}{megamaid}g;
 '
```
Then read `git diff` in full and fix any grammar the word swap broke, for example "a megamaid" where the sentence was about combing. Every changed line must read naturally.

- [ ] **Step 4: Regenerate and run the gates**

```bash
bash scripts/test-megamaid.sh --update && bash scripts/test-manifest.sh --update && git diff --stat -- scripts/fixtures
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
```
Re-run the Step 1 commands: expected `0` and `2`. Also: `bash scripts/check-contract.sh | grep 'identifier at' | cut -d' ' -f5 | cut -d: -f1 | sort -u` prints only `PLAYBOOK.md`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(prose): megamaid product name, lineage headers, smoke wording, drop review trigger"
```

---

### Task 8: Migration script (notices, `migrate config`, `migrate manifest`)

**Files:**
- Create: `scripts/migrate.py`
- Create: `scripts/fixtures/migrate/layouts/**` (inputs) and `scripts/fixtures/migrate/expected/*.out`
- Modify: `scripts/megamaid.py` (import, `load_migrate`, `cmd_config`, `cmd_migrate_config`, `cmd_migrate_manifest`, argparse, docstring)
- Modify: `scripts/test-megamaid.sh` (second case block, shared diff loop)

**Interfaces:**
- Consumes: from Task 4, `megamaid.py`'s `die`, `load_layer`, `merged_config`, `main`'s `common` parser, and `test-megamaid.sh`'s `S P H R T TR TL norm UPDATE`. From Task 6, `models.vacu_suck` in the fixture plugin's `config/defaults.json`.
- Produces:
  - In `migrate.py`: `MigrateError(Exception)`; `read_old_config(dir) -> dict`; `notices(home, project_root, new_patterns) -> list[str]`; `translate(old: dict, defaults: dict) -> (dict, list[str])`; `move_manifest(home, project_root, new_patterns, mode: "move"|"copy") -> str`.
  - CLI: `megamaid.py migrate config --layer home|project [config flags]` and `megamaid.py migrate manifest --move|--copy [config flags]`. Task 9's prose calls these exact command lines.

- [ ] **Step 1: Create the fixture layouts**

Create these files (`.keep` files are empty; they exist only so git tracks the folder):

```
scripts/fixtures/migrate/layouts/home-only/home/.claude/comb.config.json      {"models": {"review": "sonnet"}}
scripts/fixtures/migrate/layouts/home-only/project/.keep
scripts/fixtures/migrate/layouts/project-only/home/.keep
scripts/fixtures/migrate/layouts/project-only/project/.claude/comb.config.json  {"models": {"review": "sonnet"}}
scripts/fixtures/migrate/layouts/both/home/.keep
scripts/fixtures/migrate/layouts/both/project/.claude/comb.config.json        {}
scripts/fixtures/migrate/layouts/both/project/.claude/megamaid.config.json    {}
scripts/fixtures/migrate/layouts/mixed/home/.claude/comb.config.json          {}
scripts/fixtures/migrate/layouts/mixed/project/.claude/megamaid.config.json   {}
scripts/fixtures/migrate/layouts/same/root/.claude/comb.config.json           {}
scripts/fixtures/migrate/layouts/invalid/home/.keep
scripts/fixtures/migrate/layouts/invalid/project/.claude/comb.config.json     { not json
scripts/fixtures/migrate/layouts/manifest-default/home/.keep
scripts/fixtures/migrate/layouts/manifest-default/project/docs/combs/PATTERNS.md   # PATTERNS — fixture
scripts/fixtures/migrate/layouts/manifest-configured/home/.keep
scripts/fixtures/migrate/layouts/manifest-configured/project/.claude/comb.config.json  {"paths": {"patterns": "docs/old/PATTERNS.md"}}
scripts/fixtures/migrate/layouts/manifest-configured/project/docs/old/PATTERNS.md      # PATTERNS — fixture
scripts/fixtures/migrate/layouts/manifest-oldnull/home/.keep
scripts/fixtures/migrate/layouts/manifest-oldnull/project/.claude/comb.config.json     {"paths": {"patterns": null}}
scripts/fixtures/migrate/layouts/manifest-oldnull/project/docs/combs/PATTERNS.md       # PATTERNS — fixture
scripts/fixtures/migrate/layouts/manifest-newnull/home/.keep
scripts/fixtures/migrate/layouts/manifest-newnull/project/.claude/megamaid.config.json {"paths": {"patterns": null}}
scripts/fixtures/migrate/layouts/manifest-newnull/project/docs/combs/PATTERNS.md       # PATTERNS — fixture
scripts/fixtures/migrate/layouts/kept-path/home/.keep
scripts/fixtures/migrate/layouts/kept-path/project/.claude/megamaid.config.json        {"paths": {"patterns": "docs/combs/PATTERNS.md"}}
scripts/fixtures/migrate/layouts/kept-path/project/docs/combs/PATTERNS.md              # PATTERNS — fixture
scripts/fixtures/migrate/layouts/list/home/.keep
scripts/fixtures/migrate/layouts/list/project/.claude/comb.config.json        []
scripts/fixtures/migrate/layouts/translate/home/.keep
scripts/fixtures/migrate/layouts/bom/home/.keep
scripts/fixtures/migrate/layouts/effort-scalar/home/.keep
scripts/fixtures/migrate/layouts/effort-scalar/project/.claude/comb.config.json   {"effort": "high", "models": "opus"}
```

Create the two folders that no listed file creates: `mkdir -p scripts/fixtures/migrate/layouts/{bom,translate}/project/.claude`

The BOM file: `printf '\xEF\xBB\xBF{"models": {"the_desert": "haiku"}}\n' > scripts/fixtures/migrate/layouts/bom/project/.claude/comb.config.json`

`scripts/fixtures/migrate/layouts/translate/project/.claude/comb.config.json`:

```json
{
  "paths": {"reviews": "docs/combs/reviews", "nope": 1, "nope2": null},
  "directives": {"bogus": 1},
  "agents": {
    "simplifier": null,
    "code-reviewer": {"subagent_type": "comb:code-reviewer", "when_to_use": "Run comb:code-reviewer first.", "model": "opus"},
    "ours": {"subagent_type": "acme:reviewer", "when_to_use": "Custom lens."},
    "broken": {"when_to_use": "no type"}
  },
  "models": {"the_desert": "sonnet", "review": null, "fix": {"reviewer": "haiku", "unknown": "x"}},
  "effort": {"the_desert": "high", "review": "low", "nope": "max", "fix": {"implementer_trivial": "low"}},
  "fix": {"commit_per_item": true},
  "legacy": {"x": 1},
  "dropped": null
}
```

- [ ] **Step 2: Write the failing tests (test-megamaid.sh)**

In `scripts/test-megamaid.sh`, insert this block after the existing `manifest.py clean` case lines and before `fail=0`:

```bash
# migrate: notices from `config`, `migrate config`, `migrate manifest`. Inputs and expected outputs
# live in scripts/fixtures/migrate/ (exempt from check-contract's old-name guard); cases run on a
# temp copy of the layouts so a move never touches the repo.
M="$ROOT/scripts/fixtures/migrate"; ME="$M/expected"
OUT2="$T/out2"; mkdir -p "$OUT2" "$ME"
cp -R "$M/layouts" "$T/L"; L="$T/L"
run2() { name=$1; shift; python3 -I "$S" "$@" 2>&1 | norm > "$OUT2/$name.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/$name.out"; }
runn() { name=$1; shift; python3 -I "$S" "$@" 2>&1 >/dev/null | norm > "$OUT2/$name.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/$name.out"; }
lay() { LAY=(--plugin-root "$P" --home "$L/$1/home" --project-root "$L/$1/project"); }
lay home-only;           runn notice-home                config "${LAY[@]}"
lay project-only;        runn notice-project             config "${LAY[@]}"
lay both;                runn notice-both                config "${LAY[@]}"
lay mixed;               runn notice-mixed               config "${LAY[@]}"
ln -s "$T/L/same/root" "$T/same-link"
runn notice-same config --plugin-root "$P" --home "$T/same-link" --project-root "$TR/L/same/root"
lay invalid;             runn notice-invalid             config "${LAY[@]}"
lay manifest-default;    runn notice-manifest-default    config "${LAY[@]}"
lay manifest-configured; runn notice-manifest-configured config "${LAY[@]}"
lay manifest-oldnull;    runn notice-manifest-oldnull    config "${LAY[@]}"
lay manifest-newnull;    runn notice-manifest-newnull    config "${LAY[@]}"
lay kept-path;           runn notice-kept-path           config "${LAY[@]}"
mkdir -p lone && cp "$S" lone/
python3 -I lone/megamaid.py config "${C[@]}" 2>&1 >/dev/null | norm > "$OUT2/lone.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/lone.out"
python3 -I lone/megamaid.py migrate config --layer home "${C[@]}" 2>&1 | norm > "$OUT2/lone-migrate.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/lone-migrate.out"
lay translate;           run2 translate         migrate config --layer project "${LAY[@]}"
lay bom;                 run2 translate-bom     migrate config --layer project "${LAY[@]}"
lay invalid;             run2 translate-badjson migrate config --layer project "${LAY[@]}"
lay list;                run2 translate-list    migrate config --layer project "${LAY[@]}"
lay effort-scalar;       run2 translate-scalar  migrate config --layer project "${LAY[@]}"
lay home-only;           run2 translate-missing migrate config --layer project "${LAY[@]}"
lay home-only;           run2 translate-home    migrate config --layer home "${LAY[@]}"
run2 translate-same migrate config --layer project --plugin-root "$P" --home "$L/same/root" --project-root "$L/same/root"
lay manifest-default;    run2 manifest-move       migrate manifest --move "${LAY[@]}"
                         run2 manifest-move-again migrate manifest --move "${LAY[@]}"
lay manifest-configured; run2 manifest-copy       migrate manifest --copy "${LAY[@]}"
                         run2 manifest-copy-again migrate manifest --copy "${LAY[@]}"
lay kept-path;           run2 manifest-kept       migrate manifest --copy "${LAY[@]}"
lay project-only;        run2 manifest-missing    migrate manifest --copy "${LAY[@]}"
lay manifest-newnull;    run2 manifest-disabled   migrate manifest --copy "${LAY[@]}"
```

Replace the existing diff loop (`fail=0` through `done`) and the three lines after it (`[ "$UPDATE" = 1 ] && …`, `[ "$fail" = 0 ] && echo "test-megamaid: OK …"`, `exit $fail`) with:

```bash
fail=0
check() {  # $1 output dir, $2 expected dir
  for o in "$1"/*; do
    n=$(basename "$o")
    if [ "$UPDATE" = 1 ]; then cp "$o" "$2/$n"; continue; fi
    if [ ! -f "$2/$n" ]; then echo "FAIL: no expected file for $n"; fail=1; continue; fi
    if ! diff -u "$2/$n" "$o" > "$T/diff.txt"; then echo "FAIL: $n differs"; cat "$T/diff.txt"; fail=1; fi
  done
}
check "$OUT" "$E"; check "$OUT2" "$ME"
[ "$UPDATE" = 1 ] && { echo "expected files updated in scripts/fixtures/megamaid/expected/ and scripts/fixtures/migrate/expected/"; exit 0; }
[ "$fail" = 0 ] && echo "test-megamaid: OK ($(( $(ls "$E" | wc -l) + $(ls "$ME" | wc -l) )) expectations)"
exit $fail
```

- [ ] **Step 3: Run to see it fail**

Run: `bash scripts/test-megamaid.sh`
Expected: FAIL: one `no expected file for <case>.out` line per migrate case (28), and exit 1.

- [ ] **Step 4: Create `scripts/migrate.py`**

```python
#!/usr/bin/env python3
"""Migration from the plugin megamaid was forked from: notices, config translation, manifest move/copy.

Every name of the earlier plugin lives in this file, so the rest of megamaid never names it
(check-contract's old-name guard exempts this file and scripts/fixtures/migrate/). Loaded by
scripts/megamaid.py by file path; not run on its own. Stdlib only.

  notices(home, project_root, new_patterns) -> list of `notice:` lines for `megamaid.py config`
  read_old_config(dir) -> dict                  the earlier config at <dir>/.claude, or MigrateError
  translate(old, defaults) -> (new, dropped)    the spec's rule order: agents, effort, models, the rest
  move_manifest(home, project_root, new_patterns, mode) -> "moved|copied <src> -> <dst>"
"""
import json
import os
import shutil

OLD_CONFIG = "comb.config.json"
NEW_CONFIG = "megamaid.config.json"
OLD_MANIFEST = "docs/combs/PATTERNS.md"
OLD_TYPE = "comb:"
NEW_TYPE = "megamaid:"
RENAMED_LANES = {"the_desert": "vacu_suck"}
EMPTY = object()


class MigrateError(Exception):
    pass


def real(path):
    return os.path.realpath(path)


def layer_dirs(home, project_root):
    """[home, project] realpaths; one entry when they are the same directory."""
    h, r = real(home), real(project_root)
    return [r] if h == r else [h, r]


def read_json(path):
    if not os.path.exists(path):
        raise MigrateError("%s: missing" % path)
    try:
        with open(path, encoding="utf-8-sig") as f:
            data = json.load(f)
    except json.JSONDecodeError as ex:
        raise MigrateError("invalid JSON in %s: %s" % (path, ex.msg))
    except OSError as ex:
        raise MigrateError("%s: %s" % (path, ex.strerror))
    if not isinstance(data, dict):
        raise MigrateError("%s: top level is not an object" % path)
    return data


def read_old_config(directory):
    return read_json(os.path.join(directory, ".claude", OLD_CONFIG))


def old_manifest(home, project_root):
    """Realpath of the earlier plugin's manifest, or None when its paths.patterns is null or not a string.

    Same result as deep-merging the earlier config layers over the default, for this one key:
    an object `paths` overrides `patterns` when present; null or a non-object replaces all of `paths`.
    Unreadable layers are skipped (the notice path must never fail `config`)."""
    value = OLD_MANIFEST
    for d in layer_dirs(home, project_root):
        try:
            layer = read_old_config(d)
        except MigrateError:
            continue
        if "paths" not in layer:
            continue
        p = layer["paths"]
        if isinstance(p, dict):
            if "patterns" in p:
                value = p["patterns"]
        else:
            value = None
    if not isinstance(value, str):
        return None
    return real(os.path.join(project_root, value))


def new_manifest(project_root, new_patterns):
    if not isinstance(new_patterns, str):
        return None
    return real(os.path.join(project_root, new_patterns))


def notices(home, project_root, new_patterns):
    out = []
    for d in layer_dirs(home, project_root):
        old = os.path.join(d, ".claude", OLD_CONFIG)
        if os.path.exists(old) and not os.path.exists(os.path.join(d, ".claude", NEW_CONFIG)):
            out.append("notice: %s is not read; run /megamaid:configure to migrate it" % real(old))
    src, dst = old_manifest(home, project_root), new_manifest(project_root, new_patterns)
    if src and os.path.isfile(src) and dst and not os.path.exists(dst):
        out.append("notice: PATTERNS manifest at %s is not read; run /megamaid:configure to move or copy it" % src)
    return out


def keep(value, schema, path, dropped):
    """value filtered to the dotted paths that exist in schema. A leaf on either side is copied as is;
    an object left empty by dropping returns EMPTY (omitted by the caller)."""
    if not isinstance(value, dict) or not isinstance(schema, dict):
        return value
    out = {}
    for k, v in value.items():
        if k in schema:
            r = keep(v, schema[k], path + [k], dropped)
            if r is not EMPTY:
                out[k] = r
        else:
            dropped.append(".".join(path + [k]))
    return out if out or not value else EMPTY


def retype(entry):
    if isinstance(entry, dict) and isinstance(entry.get("subagent_type"), str) \
            and entry["subagent_type"].startswith(OLD_TYPE):
        entry = dict(entry)
        entry["subagent_type"] = NEW_TYPE + entry["subagent_type"][len(OLD_TYPE):]
    return entry


def translate(old, defaults):
    """A non-object `effort` is dropped (megamaid has no `effort` default to keep it against); a
    non-object `models` is copied as is (defaults has `models`, and a leaf on either side is copied)."""
    new, dropped = {}, []
    for k, v in old.items():
        if k == "agents":
            r = {role: retype(e) for role, e in v.items()} if isinstance(v, dict) else v
        elif k in ("models", "effort"):
            if not isinstance(v, dict) and k == "effort":
                dropped.append(k)
                continue
            if isinstance(v, dict):
                v = {RENAMED_LANES.get(lane, lane): x for lane, x in v.items()}
            r = keep(v, defaults.get("models"), [k], dropped)
        elif k in defaults:
            r = keep(v, defaults[k], [k], dropped)
        else:
            dropped.append(k)
            continue
        if r is not EMPTY:
            new[k] = r
    return new, dropped


def move_manifest(home, project_root, new_patterns, mode):
    src = old_manifest(home, project_root)
    if not src or not os.path.isfile(src):
        raise MigrateError("no PATTERNS manifest from an earlier install")
    dst = new_manifest(project_root, new_patterns)
    if not dst:
        raise MigrateError("paths.patterns is disabled")
    if os.path.exists(dst):
        raise MigrateError("%s exists; not overwritten" % dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if mode == "move":
        shutil.move(src, dst)
        return "moved %s -> %s" % (src, dst)
    shutil.copy2(src, dst)
    return "copied %s -> %s" % (src, dst)
```

- [ ] **Step 5: Wire it into `scripts/megamaid.py`**

Add `import importlib.util` to the imports. Under `# ---- utilities`, after `project_root_default()`:

```python
def load_migrate():
    """scripts/migrate.py, loaded by file path: python3 -I drops this script's directory from sys.path."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrate.py")
    try:
        spec = importlib.util.spec_from_file_location("megamaid_migrate", path)
        mod = importlib.util.module_from_spec(spec)
        sys.dont_write_bytecode = True  # -I does not imply -B; keep the plugin directory clean
        spec.loader.exec_module(mod)
        return mod
    except Exception as ex:
        die("cannot load scripts/migrate.py: %s" % ex)


def patterns_value(cfg):
    paths = cfg.get("paths")
    return paths.get("patterns") if isinstance(paths, dict) else None
```

Replace `cmd_config`:

```python
def cmd_config(a):
    m = load_migrate()
    cfg = merged_config(a)
    for line in m.notices(a.home, a.project_root, patterns_value(cfg)):
        sys.stderr.write(line + "\n")
    sys.stderr.flush()
    print(json.dumps(cfg, indent=1, sort_keys=True, ensure_ascii=False))
```

Add after `cmd_config`:

```python
def cmd_migrate_config(a):
    m = load_migrate()
    try:
        old = m.read_old_config(a.home if a.layer == "home" else a.project_root)
    except m.MigrateError as ex:
        die(str(ex))
    defaults = load_layer(os.path.join(a.plugin_root, "config", "defaults.json"), required=True)
    new, dropped = m.translate(old, defaults)
    for k in dropped:
        sys.stderr.write("dropped: %s\n" % k)
    sys.stderr.flush()
    print(json.dumps(new, indent=2, ensure_ascii=False))


def cmd_migrate_manifest(a):
    m = load_migrate()
    cfg = merged_config(a)
    try:
        print(m.move_manifest(a.home, a.project_root, patterns_value(cfg), "move" if a.move else "copy"))
    except m.MigrateError as ex:
        die(str(ex))
```

In `main()`, after the `findings` subparser:

```python
    s = sub.add_parser("migrate", help="carry over a config or PATTERNS manifest from an earlier install")
    msub = s.add_subparsers(dest="what", required=True)
    t = msub.add_parser("config", parents=[common], help="print an earlier install's config translated to megamaid's keys")
    t.add_argument("--layer", required=True, choices=["home", "project"])
    t.set_defaults(fn=cmd_migrate_config)
    t = msub.add_parser("manifest", parents=[common], help="move or copy an earlier install's PATTERNS manifest to paths.patterns")
    g = t.add_mutually_exclusive_group(required=True)
    g.add_argument("--move", action="store_true")
    g.add_argument("--copy", action="store_true")
    t.set_defaults(fn=cmd_migrate_manifest)
```

In the module docstring, change the first line to `"""megamaid resolver: config, resolve, directives, brief, report-name, batches, findings, migrate.`. In the `config` entry, add under `stderr:`:
`then one \`notice:\` line per file from an earlier install that is not read (scripts/migrate.py); notices never change the exit code.`
Then append this CLI entry:

```
  megamaid.py migrate config --layer home|project [config flags]
    stdout: that layer's earlier-install config translated to megamaid's keys, JSON indent 2, input order.
    stderr: `dropped: <dotted.key>` per key megamaid has no use for. Rules: scripts/migrate.py translate().
    exit 2: `megamaid.py: <path>: missing`, `… invalid JSON in <path>: <msg>`, `… <path>: top level is not an object`.

  megamaid.py migrate manifest --move|--copy [config flags]
    Moves or copies the earlier install's PATTERNS manifest to megamaid's paths.patterns; never runs git.
    stdout: `moved|copied <src> -> <dst>` (realpaths).
    exit 2: `no PATTERNS manifest from an earlier install`, `paths.patterns is disabled`, `<dst> exists; not overwritten`.
    Any command that needs scripts/migrate.py exits 2 with `cannot load scripts/migrate.py: <error>` when it can't be loaded.
```

- [ ] **Step 6: Generate the expected outputs and review them**

Run: `bash scripts/test-megamaid.sh --update`, then read every file in `scripts/fixtures/migrate/expected/`. Each must match the following (all paths are normalised to `TMP`):

- `notice-home.out`: `notice: TMP/L/home-only/home/.claude/comb.config.json is not read; run /megamaid:configure to migrate it`, then `exit=0`.
- `notice-project.out`: the same for `project-only/project`.
- `notice-both.out`: only `exit=0`.
- `notice-mixed.out`: one notice, for `mixed/home`.
- `notice-same.out`: exactly one notice, for `same/root` (the realpath, not the symlink).
- `notice-invalid.out`: one notice for `invalid/project`, then `exit=0`.
- `notice-manifest-default.out`: `notice: PATTERNS manifest at TMP/L/manifest-default/project/docs/combs/PATTERNS.md is not read; run /megamaid:configure to move or copy it`.
- `notice-manifest-configured.out`: a config notice, then a manifest notice for `docs/old/PATTERNS.md`.
- `notice-manifest-oldnull.out`: only the config notice.
- `notice-manifest-newnull.out`: only `exit=0`.
- `notice-kept-path.out`: only `exit=0`.
- `lone.out` and `lone-migrate.out`: `megamaid.py: cannot load scripts/migrate.py: …`, then `exit=2`.
- `translate.out`: in this order, `dropped: paths.nope`, `dropped: paths.nope2`, `dropped: directives.bogus`, `dropped: models.fix.unknown`, `dropped: effort.nope`, `dropped: legacy`, `dropped: dropped`. The JSON has no `directives` key (its only key was dropped). Then JSON with `paths.reviews` (`docs/combs/reviews`, unchanged); `agents` with `simplifier: null`, `code-reviewer.subagent_type: "megamaid:code-reviewer"` (its `when_to_use` unchanged), `ours` unchanged and `broken` unchanged; `models` `{"vacu_suck": "sonnet", "review": null, "fix": {"reviewer": "haiku"}}`; `effort` `{"vacu_suck": "high", "review": "low", "fix": {"implementer_trivial": "low"}}`; `fix` `{"commit_per_item": true}`. Then `exit=0`.
- `translate-bom.out`: `{"models": {"vacu_suck": "haiku"}}` (indented), `exit=0`.
- `translate-badjson.out`: `megamaid.py: invalid JSON in …/invalid/project/.claude/comb.config.json: …`, `exit=2`.
- `translate-scalar.out`: `dropped: effort`, then `{"models": "opus"}` (indented), `exit=0`.
- `translate-list.out`: `megamaid.py: …: top level is not an object`, `exit=2`.
- `translate-missing.out`: `megamaid.py: …/home-only/project/.claude/comb.config.json: missing`, `exit=2`.
- `translate-home.out`: `{"models": {"review": "sonnet"}}`, `exit=0`.
- `translate-same.out`: `{}`, `exit=0`.
- `manifest-move.out`: `moved TMP/L/manifest-default/project/docs/combs/PATTERNS.md -> TMP/L/manifest-default/project/docs/megamaid/PATTERNS.md`, `exit=0`.
- `manifest-move-again.out`: `megamaid.py: no PATTERNS manifest from an earlier install`, `exit=2`.
- `manifest-copy.out`: `copied …/docs/old/PATTERNS.md -> …/docs/megamaid/PATTERNS.md`, `exit=0`.
- `manifest-copy-again.out`: `megamaid.py: …/docs/megamaid/PATTERNS.md exists; not overwritten`, `exit=2`.
- `manifest-kept.out`: `megamaid.py: …/kept-path/project/docs/combs/PATTERNS.md exists; not overwritten`, `exit=2`.
- `manifest-missing.out`: `megamaid.py: no PATTERNS manifest from an earlier install`, `exit=2`.
- `manifest-disabled.out`: `megamaid.py: paths.patterns is disabled`, `exit=2`.

If any file differs from this list, fix the code, not the expected file, then re-run `--update`.

- [ ] **Step 7: Run the tests and gates**

```bash
bash scripts/test-megamaid.sh
GUARD=off bash scripts/check-contract.sh && claude plugin validate .
bash scripts/check-contract.sh | grep 'identifier at' | grep -v 'PLAYBOOK.md' || echo "no new guard hits"
```
Expected: `test-megamaid: OK (…)`, `check-contract: OK`, `no new guard hits`.

- [ ] **Step 8: Commit**

```bash
git add scripts/migrate.py scripts/megamaid.py scripts/test-megamaid.sh scripts/fixtures/migrate
git commit -m "feat(migrate): notices and migrate config|manifest for an earlier install"
bash scripts/test-megamaid.sh && git status --short scripts/fixtures/migrate   # nothing: cases run on the temp copy
```

---

### Task 9: Migration in the skills

**Files:**
- Create: `shared/manifest-migration.md`
- Modify: `shared/config-loading.md`, `skills/configure/SKILL.md` (Inputs, new Step 2a), `skills/patterns/SKILL.md` (Step 4, Shave mode), `scripts/check-contract.sh` (section 5 needles)

**Interfaces:**
- Consumes: the Task 8 CLI lines `megamaid.py" migrate config --layer home|project` and `megamaid.py" migrate manifest --move|--copy`, and the two notice texts.

- [ ] **Step 1: Write the failing needles**

In `scripts/check-contract.sh` section 5, after the `scan-rules.md` loop, add:

```bash
for skill in configure patterns; do
  grep -Fq 'shared/manifest-migration.md' "skills/$skill/SKILL.md" || { echo "FAIL: skills/$skill does not point at shared/manifest-migration.md"; fail=1; }
done
grep -Fq 'megamaid.py" migrate config' skills/configure/SKILL.md || { echo "FAIL: skills/configure does not invoke megamaid.py migrate config"; fail=1; }
grep -Fq 'megamaid.py" migrate manifest' shared/manifest-migration.md 2>/dev/null || { echo "FAIL: shared/manifest-migration.md does not invoke megamaid.py migrate manifest"; fail=1; }
# The skills quote the notices printed by scripts/migrate.py: the wording moves together.
for f in scripts/migrate.py shared/manifest-migration.md skills/patterns/SKILL.md skills/configure/SKILL.md; do
  grep -Fq 'notice: PATTERNS manifest at' "$f" 2>/dev/null || { echo "FAIL: $f does not carry the manifest notice wording"; fail=1; }
done
for f in scripts/migrate.py skills/configure/SKILL.md; do
  grep -Fq 'is not read; run /megamaid:configure to migrate it' "$f" 2>/dev/null || { echo "FAIL: $f does not carry the config notice wording"; fail=1; }
done
```

- [ ] **Step 2: Run to see it fail**

Run: `GUARD=off bash scripts/check-contract.sh`
Expected: the new FAIL lines for the skills and the shared block (the two `scripts/migrate.py` needles already pass), and a non-zero exit.

- [ ] **Step 3: Create `shared/manifest-migration.md`**

````markdown
# Shared block: moving a PATTERNS manifest from an earlier install

Run this when `megamaid.py config` printed `notice: PATTERNS manifest at <path> is not read`. The manifest named in the notice comes from the plugin megamaid was forked from; megamaid reads only its own `paths.patterns`.

1. Ask:

   ```
   A PATTERNS manifest from an earlier install is at <path> and is not read.
     (a) Move it to <paths.patterns>
     (b) Copy it to <paths.patterns>
     (c) Skip
   Pick one:
   ```

2. On (a) or (b), run from the project root, with `--move` for (a) or `--copy` for (b):

   ```
   python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" migrate manifest --move
   ```

   Show its one line of output. A non-zero exit prints why (no manifest found, `paths.patterns` disabled, or the target already exists). Show it and go on without the manifest.
3. On (c), go on. The notice repeats on later runs until a manifest exists at `paths.patterns`.
````

- [ ] **Step 4: Edit `shared/config-loading.md`**

Append to its last paragraph:
`` `notice:` lines name a file from an earlier install that is not read. Pass them on to the user in your final report and carry on, unless your skill says how to act on them (configure, patterns). ``

- [ ] **Step 5: Edit `skills/configure/SKILL.md`**

In the frontmatter `description`, before the final `.`, add: `, or carry over settings or a PATTERNS manifest from an earlier install`.


Under `## Inputs`, after `If either is missing, ask once.`, add:
`When the user gave no change, run Step 2 first: if it prints \`notice:\` lines, handling them (Step 2a) is the request.`

Insert a new section after Step 2 (before `## Step 3`):

````markdown
## Step 2a: Files from an earlier install

If Step 2's `config` run printed `notice:` lines, handle them before the user's change, in the order printed:

- **`notice: <path> is not read; run /megamaid:configure to migrate it`.** This is a config file from the plugin megamaid was forked from. Its layer is project when `<path>` is under `<project-root>/.claude/`, and home (global scope) otherwise. Run:

  ```
  python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/megamaid.py" migrate config --layer home
  ```

  Use `--layer project` for the project layer. Its stdout is the translated config. Each stderr `dropped: <key>` line is a key megamaid has no use for. Show both, and ask whether to write the result as `megamaid.config.json` at that layer. On yes, write it with Step 5's formatting and verify it with Step 6. Never change or delete the file named in the notice.
- **After writing a migrated config,** re-run `config` and use its notices from here on.
- **`notice: PATTERNS manifest at <path> is not read; …`:** follow `${CLAUDE_PLUGIN_ROOT}/shared/manifest-migration.md`.

Then go on to Step 3 with the user's change, or stop if the migration was the whole request.
````

- [ ] **Step 6: Edit `skills/patterns/SKILL.md`**

Under `## Step 4: Existing-manifest check`, insert before `If \`paths.patterns\` resolves to an existing file`:
`If Step 1's \`config\` run printed \`notice: PATTERNS manifest at … is not read\`, first follow \`${CLAUDE_PLUGIN_ROOT}/shared/manifest-migration.md\`; a manifest it moved or copied now exists at \`paths.patterns\` for the check below.`

Under `## Shave mode (\`--shave\`)`, in the same paragraph (line ~279), insert this sentence directly before the sentence that starts `Requires an existing manifest at`:
`If \`config\` printed \`notice: PATTERNS manifest at … is not read\`, first follow \`${CLAUDE_PLUGIN_ROOT}/shared/manifest-migration.md\`.`

- [ ] **Step 7: Run the gates**

Run: `GUARD=off bash scripts/check-contract.sh && claude plugin validate .`
Expected: `check-contract: OK`. Section 2 resolves the new shared reference. Section 3 finds no re-inlined block. Then run `bash scripts/check-contract.sh | grep 'identifier at' | grep -v PLAYBOOK.md`: expected no output.

- [ ] **Step 8: Commit**

```bash
git add shared/manifest-migration.md shared/config-loading.md skills/configure/SKILL.md skills/patterns/SKILL.md scripts/check-contract.sh
git commit -m "feat(migrate): configure and patterns offer migration from an earlier install"
```

---

### Task 10: Docs

**Files:**
- Replace: `PLAYBOOK.md` (from `docs/handover/PLAYBOOK.md`, edited)
- Modify: `README.md`
- Outside git (controller only, not committed): `docs/handover/*`, memory files

**Interfaces:**
- Produces: a tree where the guard passes with `GUARD` on.

- [ ] **Step 1: Failing check**

Run: `bash scripts/check-contract.sh; echo exit=$?`
Expected: `PLAYBOOK.md` identifier hits, and `exit=1`. Also `grep -c 'github.com/olioskar/comb-the-desert-claude-plugin' README.md` (expected `0`, later `3`) and `grep -c 'plugin marketplace add' README.md` (expected `1`, later `0`).

- [ ] **Step 2: Replace PLAYBOOK.md**

`cp docs/handover/PLAYBOOK.md PLAYBOOK.md`, then edit the root `PLAYBOOK.md`:
- `review reports in \`docs/combs/reviews/\` (renamed in Phase 0)` → `review reports in \`docs/megamaid/reviews/\``.
- In "Where things live":
  - in the `scripts/` bullet, add: `` `scripts/migrate.py` holds every name of the plugin megamaid was forked from (the old-name guard exempts it). ``
  - in the `skills/*/SKILL.md` and `shared/*.md` bullet, add: `` `shared/manifest-migration.md` is the manifest-migration offer used by configure and patterns. ``
  - in the `docs/` bullet, replace `and this handover folder.` with `` and `docs/handover/` (plan, ledger, state). This playbook is tracked at the repo root. ``
- In "Release gate", after item 4, add: `` `scripts/smoke.sh` runs once before a PR: the free gates plus two short `claude -p` help checks (a few cents). ``
- In "Session continuity", replace the bullet list with:
  - `` `PLAYBOOK.md` (repo root): this file. ``
  - `` `docs/handover/plan.md`: the phase roadmap. Edit it when order or scope changes. ``
  - `` `docs/handover/<line-of-work>.md` (now `megamaid-dev.md`): a snapshot of state, next steps, decisions and open questions. Rewrite it at each milestone and before a session ends. ``
  - `` `docs/handover/ledger.md`: append-only, one dated line per event. ``

  Change the intro line `Everything is in \`docs/handover/\`:` to `Session state is in \`docs/handover/\`; the playbook is tracked at the repo root:`.

- [ ] **Step 3: Edit README.md**

- Line 1: `# megamaid` (if Task 7 left anything else).
- After the intro paragraphs (before `## Commands`), add:

  ```markdown
  Forked from [comb](https://github.com/olioskar/comb-the-desert-claude-plugin) 0.15.3. From Phase 1 megamaid moves comb's rules into a hooks module and will require a mod-capable Claude Code; comb stays for builds without mods.

  With [comb](https://github.com/olioskar/comb-the-desert-claude-plugin) also installed, both plugins' model-invocable skills trigger on the same phrases; install one, or use explicit `/megamaid:*` commands.
  ```
- `## Install`: replace everything from the marketplace code fence up to (not including) `## Quick start` with:

  ````markdown
  ```bash
  claude --plugin-dir /path/to/megamaid-claude-plugin
  ```

  Coming from [comb](https://github.com/olioskar/comb-the-desert-claude-plugin)? `/megamaid:configure` migrates its config and PATTERNS manifest; move old reports with `git mv docs/combs docs/megamaid`. An empty `{}` `megamaid.config.json` silences the config notice.
  ````
- Leave `## Requirements` unchanged.

- [ ] **Step 4: Run the gates with the guard on**

Run: `bash scripts/check-contract.sh && claude plugin validate .`
Expected: `check-contract: OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add PLAYBOOK.md README.md
git commit -m "docs: megamaid README and the current playbook at the root"
```

- [ ] **Step 6: Outside git (controller)**

- `rm docs/handover/PLAYBOOK.md`
- `docs/handover/plan.md`:
  - Phase 0 "Done when" → `Done when: the free gates pass under the new name; smoke.sh passes once; no eval run (deliberate exception, see ledger).`
  - Phase 1: add `Hooks key on the megamaid:<agent> types and the megamaid skill names fixed in Phase 0.` and add to its Done-when `the full eval suite runs and is compared with comb v0.15.0's results`.
  - Line 25: drop the parenthetical `(the working playbook is now \`docs/handover/PLAYBOOK.md\`)`; the decision is recorded in the ledger.
  - Line 49: `A fix / the-desert pane` → `A fix / vacu-suck pane`.
- `docs/handover/megamaid-dev.md`: rewrite State, Next and Decisions as follows.
  - State: Phase 0 implemented on `feat/v0.1.0-identity`.
  - Next: the two-lens branch review, then push and PR on the maintainer's go, then the Phase 1 spec (smoke already ran in Task 11).
  - Remove every `import-comb` mention.
  - Decisions: `/megamaid:vacu-suck`, `megamaid.py migrate config|manifest`, the old-name guard, PLAYBOOK at the root, the eval exception.
- Memory: in `project_megamaid.md` and its `MEMORY.md` line, point to the root `PLAYBOOK.md` plus `docs/handover/` (plan, ledger, state). In `feedback_eval_cadence.md`, write "the eval suite (comb, now megamaid)".
- Ledger lines: the Phase 0 eval exception, the trigger removal, the smoke decision, and this plan's four deviations.

---

### Task 11: Release

**Files:**
- Replace: `CHANGELOG.md`
- Modify: `.claude-plugin/plugin.json` (`version`), README Status line

- [ ] **Step 1: Failing check**

Run: `grep -c '^## \[' CHANGELOG.md; grep -c '"version": "0.1.0"' .claude-plugin/plugin.json`
Expected: `26` and `0` (later `2` and `1`).

- [ ] **Step 2: Write CHANGELOG.md** (use today's date for `<date>`)

```markdown
# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — <date>

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
```

- [ ] **Step 3: Version and Status line**

Set `"version": "0.1.0"` in `.claude-plugin/plugin.json`. In README `## Status`, change `v0.15.3. See [CHANGELOG.md]` to `v0.1.0. See [CHANGELOG.md]`.

- [ ] **Step 4: Gates and smoke**

```bash
claude plugin validate . && bash scripts/check-contract.sh
bash scripts/smoke.sh
```
Expected: `check-contract: OK` (section 6 confirms that the README says v0.1.0), and smoke passes. Re-run the Step 1 commands: expected `2` and `1`. Smoke is the only paid step in this plan, at a few cents.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md .claude-plugin/plugin.json README.md
git commit -m "docs(release): v0.1.0 — megamaid identity"
```

After this: the two-lens branch review (contract; scripts and tests) per the playbook, then push only on the maintainer's go.
