#!/usr/bin/env bash
# Release-gate greps for the megamaid plugin's shipped contract.
# Needs claude and node (npx) on PATH; the first npx run needs network. Run from anywhere.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
for tool in claude node npx; do
  command -v "$tool" >/dev/null 2>&1 || { echo "FAIL: $tool is not on PATH (check-contract needs claude, node and npx)"; exit 1; }
done

# 1. No dead spec citations in shipped files (the design spec does not ship).
if grep -rn "spec §\|decision §" skills/ agents/ shared/ directives/ README.md 2>/dev/null; then
  echo "FAIL: dead spec/decision citations found in shipped files"
  fail=1
fi

# 2. Every ${CLAUDE_PLUGIN_ROOT}/shared/*.md reference resolves to a file.
while IFS= read -r ref; do
  rel="${ref#\$\{CLAUDE_PLUGIN_ROOT\}/}"
  if [ ! -f "$rel" ]; then
    echo "FAIL: unresolved shared reference: $ref"
    fail=1
  fi
done < <(grep -rho '\${CLAUDE_PLUGIN_ROOT}/shared/[a-z-]*\.md' skills/ agents/ README.md | sort -u)

# 3. No skill re-inlines a shared block (drift re-entry guard).
#    Needles are derived from the live blocks: the longest body line of each shared/*.md
#    (the intro before the first `## ` heading when the file has one, headings, and table rows
#    skipped), cut to 60
#    characters at a word boundary — a body copy carries it, a framing sentence does not. One historical needle guards wording
#    removed in 0.11.0 that must not return.
derive_needle() {
  { if grep -q '^## ' "$1"; then awk '/^## /{body=1} body' "$1"; else cat "$1"; fi; } | grep -v '^#' | grep -v '^|' | awk '{ if (length($0) > length(best)) best=$0 } END { print best }' \
    | sed -E 's/^(.{0,60}[^ ]*).*/\1/'
}
while IFS= read -r needle; do
  [ "${#needle}" -lt 30 ] && { echo "FAIL: derived needle too short to be safe: \"$needle\""; fail=1; continue; }
  if grep -rnF "$needle" skills/ >/dev/null 2>&1; then
    echo "FAIL: shared block re-inlined in a skill: \"$needle\""
    fail=1
  fi
done < <(for f in shared/*.md; do derive_needle "$f"; done)
if grep -rnF "read it and run the commit-based staleness heuristic" skills/ >/dev/null 2>&1; then
  echo "FAIL: pre-0.11.0 manifest-read wording returned to a skill"
  fail=1
fi

# 4. A skill that Reads another skill's body carries the plugin-root expansion paragraph:
#    Read output is not variable-substituted, so the placeholder would reach the shell literally.
while IFS= read -r f; do
  if ! grep -q 'replace it with this literal path: `\${CLAUDE_PLUGIN_ROOT}`' "$f"; then
    echo "FAIL: $f Reads another skill but has no plugin-root expansion paragraph"
    fail=1
  fi
done < <(grep -rl '\${CLAUDE_PLUGIN_ROOT}/skills/[a-z-]*/SKILL\.md' skills/ | sort -u)

# 5. Scripts: manifest.py and megamaid.py ship, their fixture tests pass, and every consuming
#    skill invokes it (the orchestrator never reads the manifest).
if [ ! -f scripts/manifest.py ]; then
  echo "FAIL: scripts/manifest.py missing"
  fail=1
elif ! python3 -I scripts/manifest.py --help >/dev/null 2>&1; then
  echo "FAIL: python3 -I scripts/manifest.py --help exits non-zero"
  fail=1
elif ! bash scripts/test-manifest.sh >/dev/null 2>&1; then
  echo "FAIL: scripts/test-manifest.sh failed (run it for the diff)"
  fail=1
elif ! grep -qF 'Excerpt grammar' scripts/manifest.py; then
  echo "FAIL: scripts/manifest.py docstring lost the excerpt grammar that shared/manifest-slicing.md points at"
  fail=1
fi
if [ ! -f scripts/megamaid.py ]; then
  echo "FAIL: scripts/megamaid.py missing"
  fail=1
elif ! python3 -I scripts/megamaid.py --help >/dev/null 2>&1; then
  echo "FAIL: python3 -I scripts/megamaid.py --help exits non-zero"
  fail=1
elif ! bash scripts/test-megamaid.sh >/dev/null 2>&1; then
  echo "FAIL: scripts/test-megamaid.sh failed (run it for the diff)"
  fail=1
fi
if ! bash scripts/test-replay.sh >/dev/null 2>&1; then
  echo "FAIL: scripts/test-replay.sh failed (run it for the diff)"
  fail=1
fi
bash scripts/test-sync-types.sh >/dev/null 2>&1 || { echo "FAIL: scripts/test-sync-types.sh failed (run it for the diff)"; fail=1; }
for skill in review plan fix; do
  if ! grep -Eq 'manifest\.py"? excerpt' "skills/$skill/SKILL.md"; then
    echo "FAIL: skills/$skill does not invoke manifest.py excerpt"
    fail=1
  fi
done
for cmd in index anchors verify gate apply; do
  if ! grep -Eq "manifest\.py\"? $cmd" skills/patterns/SKILL.md; then
    echo "FAIL: skills/patterns does not invoke manifest.py $cmd"
    fail=1
  fi
done
for skill in review plan fix patterns vacu-suck fix-auto configure; do
  grep -Fq 'megamaid.py" config' "skills/$skill/SKILL.md" || { echo "FAIL: skills/$skill does not invoke megamaid.py config"; fail=1; }
done
for skill in review plan fix; do
  grep -Fq 'megamaid.py" brief' "skills/$skill/SKILL.md" || { echo "FAIL: skills/$skill does not invoke megamaid.py brief"; fail=1; }
done
grep -Fq 'megamaid.py" batches' skills/fix/SKILL.md || { echo "FAIL: skills/fix does not invoke megamaid.py batches"; fail=1; }
grep -Fq 'megamaid.py" fix ' skills/fix/SKILL.md || { echo "FAIL: skills/fix does not invoke megamaid.py fix"; fail=1; }
# Review's verification gate checks a convention claim without reading the whole manifest (MM-043: three misses,
# each while verifying a finding).
grep -Fq '**Convention claims.**' skills/review/SKILL.md || { echo "FAIL: skills/review Step 7 has no Convention claims rule (MM-043)"; fail=1; }
# The end-of-run summary always carries the Overrides: line (two live runs wrote "no overrides" in prose instead).
for f in skills/fix/SKILL.md skills/vacu-suck/SKILL.md; do
  grep -Fq '`Overrides: none` included' "$f" || { echo "FAIL: $f does not require the Overrides: line with \`Overrides: none\` included"; fail=1; }
done
# With commits off a later item on a finished file is dispatched; its reviewer is told whose edits share the diff.
for f in skills/fix/SKILL.md shared/fix-reviewer-brief.md; do
  grep -Fq 'Finished earlier on these files:' "$f" || { echo "FAIL: $f does not carry the 'Finished earlier on these files:' line"; fail=1; }
done
grep -Fq 'megamaid.py" report-name' skills/review/SKILL.md || { echo "FAIL: skills/review does not invoke megamaid.py report-name"; fail=1; }
grep -Fq 'megamaid.py" findings' skills/plan/SKILL.md || { echo "FAIL: skills/plan does not invoke megamaid.py findings"; fail=1; }
# The hooks module repeats report-name's file shape (hooks/ledger.ts REPORT_NAME) to find the review
# report; the two must agree. The pattern is read from the source, as §11 reads the stop line.
rn=$(sed -n 's/^export const REPORT_NAME = \/\(.*\)\/$/\1/p' hooks/ledger.ts 2>/dev/null)
if [ -z "$rn" ]; then
  echo "FAIL: hooks/ledger.ts must hold one line: export const REPORT_NAME = /.../"; fail=1
else
  # The pattern is read by JavaScript and by grep -E alike: GNU grep has no \d, \w or \s in ERE.
  case $rn in *'\d'*|*'\w'*|*'\s'*) echo "FAIL: hooks/ledger.ts REPORT_NAME uses a JavaScript-only escape; write the class out ([0-9]) so grep -E reads the same pattern"; fail=1;; esac
  rd=$(mktemp -d "${TMPDIR:-/tmp}/report-name.XXXXXX")
  for args in "--pr 7" "--branch feat/x"; do
    # shellcheck disable=SC2086
    name=$(python3 -I scripts/megamaid.py report-name --reviews "$rd" $args 2>/dev/null | sed -n 's/^report: //p'); name=${name##*/}
    printf '%s\n' "$name" | grep -Eq "$rn" || { echo "FAIL: hooks/ledger.ts REPORT_NAME does not match megamaid.py report-name output ($name)"; fail=1; }
  done
  printf '%s\n' "pr-7-round1-usage.md" | grep -Eq "$rn" && { echo "FAIL: hooks/ledger.ts REPORT_NAME matches a usage file name"; fail=1; }
  rm -rf "$rd"
fi
# .megamaid/.gitignore has three writers (state_dir in megamaid.py and manifest.py, writeLedger in
# usage.ts); each must write the one line `*`, or a run's working files reach git status.
for f in scripts/megamaid.py scripts/manifest.py; do
  grep -A3 -F 'gi = os.path.join(d, ".gitignore")' "$f" | grep -qF 'f.write("*\n")' || { echo "FAIL: $f state_dir does not write .megamaid/.gitignore as the one line *"; fail=1; }
done
{ grep -qF "const GITIGNORE = '.megamaid/.gitignore'" hooks/usage.ts && grep -qF "\$.fs.write(GITIGNORE, '*\\n')" hooks/usage.ts; } || { echo "FAIL: hooks/usage.ts does not write .megamaid/.gitignore as the one line *"; fail=1; }
# Planning resolves and briefs the planner role, never the fix writer. Negative half: any resolve or
# brief line in the plan lane (--lane plan / --skill plan, in any flag order) must carry --role planner.
# Positive half: the code-block commands plan Step 6 and fix DISCOVERED run name the planner. Patterns
# start with "--", so they go through -e.
bad=$(grep -rnE -e '(resolve|brief) [^`]*--(lane|skill) plan([^.a-z_-]|$)' skills/ | grep -vF -e '--role planner')
[ -z "$bad" ] || { echo "FAIL: plan-lane resolve/brief without --role planner:"; echo "$bad"; fail=1; }
grep -qF -e 'megamaid.py" resolve --role planner --lane plan' skills/plan/SKILL.md || { echo "FAIL: skills/plan Step 6 does not run megamaid.py resolve --role planner --lane plan"; fail=1; }
grep -qF -e 'megamaid.py" brief --skill plan --role planner' skills/plan/SKILL.md || { echo "FAIL: skills/plan Step 6 does not run megamaid.py brief --skill plan --role planner"; fail=1; }
grep -qF -e 'resolve --role planner --lane plan' skills/fix/SKILL.md || { echo "FAIL: skills/fix DISCOVERED does not resolve the planner with --role planner --lane plan"; fail=1; }
for f in skills/patterns/SKILL.md agents/pattern-scanner.md; do
  grep -Fq 'shared/scan-rules.md' "$f" || { echo "FAIL: $f does not point at shared/scan-rules.md"; fail=1; }
done
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
grep -Fq 'write nothing for that layer' skills/configure/SKILL.md || { echo "FAIL: skills/configure has no instruction for a failed migrate config"; fail=1; }
grep -qF 'git diff HEAD -- <files reported by implementer>' shared/fix-reviewer-brief.md || { echo "FAIL: fix-reviewer-brief.md lost the 'git diff HEAD -- <files>' instruction (the HEAD~1 bug class)"; fail=1; }

# 6. User-facing facts that have a machine source agree with it.
version=$(python3 -c 'import json;print(json.load(open(".claude-plugin/plugin.json"))["version"])')
if ! grep -qF "v${version}. See [CHANGELOG.md]" README.md; then
  echo "FAIL: README Status line does not say v${version} (plugin.json)"
  fail=1
fi

# 7. .DS_Store is never tracked.
if git ls-files | grep -q '\.DS_Store'; then
  echo "FAIL: .DS_Store is tracked"
  fail=1
fi

# 8. Every megamaid:* subagent_type in defaults.json has an agent file; every agent file's
#    frontmatter name equals its filename (the native rule in dispatch-delivery.md compares
#    `megamaid:` + name) and is a default subagent_type somewhere.
while IFS= read -r t; do
  case "$t" in MISSING*) echo "FAIL: defaults.json role(s) without subagent_type: ${t#MISSING }"; fail=1; continue;; esac
  n="${t#megamaid:}"
  [ -f "agents/$n.md" ] || { echo "FAIL: defaults.json names $t but agents/$n.md is missing"; fail=1; }
done < <(python3 -I -c 'import json,sys
a=json.load(open("config/defaults.json"))["agents"]
bad=[k for k,v in a.items() if not (isinstance(v,dict) and isinstance(v.get("subagent_type"),str))]
if bad: print("MISSING " + " ".join(bad))
[print(v["subagent_type"]) for k,v in a.items() if k not in bad and v["subagent_type"].startswith("megamaid:")]')
for f in agents/*.md; do
  n=$(basename "$f" .md)
  [ "$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -n 1 | sed 's/[[:space:]]*$//')" = "$n" ] || { echo "FAIL: agents/$n.md frontmatter name does not equal its filename"; fail=1; }
  grep -qF "\"megamaid:$n\"" config/defaults.json || { echo "FAIL: agents/$n.md is not a default subagent_type in config/defaults.json"; fail=1; }
done
# The fixture plugin's defaults are the shipped defaults: the brief fixtures prove the shipped text.
cmp -s config/defaults.json scripts/fixtures/megamaid/plugin/config/defaults.json || { echo "FAIL: scripts/fixtures/megamaid/plugin/config/defaults.json drifted from config/defaults.json"; fail=1; }
# The writer roles' tool restrictions are exact frontmatter lines: validate accepts any text in
# disallowedTools, and a `tools:` allowlist could drop Write. Only the frontmatter counts.
frontmatter() { awk 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {exit} f' "$1" 2>/dev/null; }
frontmatter agents/planner.md | grep -qxF 'disallowedTools: Agent, Edit, NotebookEdit' || { echo "FAIL: agents/planner.md frontmatter must carry exactly 'disallowedTools: Agent, Edit, NotebookEdit'"; fail=1; }
frontmatter agents/implementer.md | grep -qxF 'disallowedTools: Agent, NotebookEdit' || { echo "FAIL: agents/implementer.md frontmatter must carry exactly 'disallowedTools: Agent, NotebookEdit'"; fail=1; }
for f in agents/planner.md agents/implementer.md; do
  frontmatter "$f" | grep -q '^tools:' && { echo "FAIL: $f has a tools: allowlist; the writer roles restrict with disallowedTools only"; fail=1; }
done
for n in code-reviewer simplifier silent-failure-hunter test-auditor consistency-auditor; do
  grep -qF "**Confidence**" "agents/$n.md" || { echo "FAIL: agents/$n.md has no Confidence line; review Step 7 treats an omitted field as unverified"; fail=1; }
done
if grep -qF -- "- \`megamaid:" shared/dispatch-delivery.md; then
  echo "FAIL: dispatch-delivery.md carries a native allowlist; the native rule is by agent name"
  fail=1
fi

# 9. Every "(default: X)" in help equals config/defaults.json (effort lanes are unset by design;
#    agents.<role> compares the subagent_type).
python3 -I - "${HELP_FILE:-skills/help/SKILL.md}" <<'PY' || fail=1
import json, re, sys
cfg = json.load(open("config/defaults.json"))
def get(path):
    cur = cfg
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur: return None
        cur = cur[k]
    return cur
bad = 0
seen = 0
for m in re.finditer(r"<?([a-z_]+(?:\.(?:[a-z_*-]+|<[a-z-]+>))+)>?\s+\(default:?\s+([^)—]+?)\s*(?:—[^)]*)?\)", open(sys.argv[1]).read()):
    key, val = m.group(1), m.group(2).strip()
    seen += 1
    if "<" in key:
        print("FAIL: help states a default on the placeholder key %s; name a concrete key" % key); bad = 1
        continue
    if key.startswith("effort.") or key.endswith(".*"):
        if val != "unset": print("FAIL: help says %s default %r; effort lanes are unset" % (key, val)); bad = 1
        continue
    if key.startswith("agents."): key += ".subagent_type"
    actual = get(key)
    actual = json.dumps(actual) if isinstance(actual, bool) else actual
    if actual is None or str(actual) != val:
        print("FAIL: help says %s (default: %s) but defaults.json has %r" % (key, val, actual)); bad = 1
if seen == 0:
    print("FAIL: help-defaults gate matched no '(default: X)' line; the help wording changed"); bad = 1
sys.exit(bad)
PY

# 10. Old-name guard: no identifier of the plugin this one was forked from, in tracked file
#     contents or paths. Exempt: CHANGELOG.md, scripts/migrate.py, scripts/fixtures/migrate/,
#     vendor/claude-code-types/ (engine text), and
#     any line carrying the old repo URL. The pattern is built from fragments so this section does
#     not match itself. GUARD=off skips the repo scan (the self-tests still run).
w='co''mb'
GUARD_WORDS="$w|${w}s|the-""desert|the_""desert"
GUARD_CAMEL="[a-z]Co""mb|[Cc]o""mb[A-Z]"
GUARD_URL="github.com/olioskar/${w}-the-""desert-claude-plugin"
GUARD_EXEMPT='^(CHANGELOG\.md|scripts/migrate\.py|scripts/fixtures/migrate/|vendor/claude-code-types/)'
# Three shapes: the word (case-insensitive, whole word), `_`-joined forms, and camelCase forms.
guard_grep() {  # $1: "files" to filter stdin paths with grep, or "git" to search contents of repo $2
  if [ "$1" = files ]; then
    local in; in=$(cat)
    printf '%s\n' "$in" | grep -iwE "$GUARD_WORDS" || [ $? -eq 1 ] || return 2
    printf '%s\n' "$in" | grep -iF -e "${w}_" -e "_$w" -e "${w}s_" || [ $? -eq 1 ] || return 2
    printf '%s\n' "$in" | grep -E "$GUARD_CAMEL" || [ $? -eq 1 ] || return 2
  else
    git -C "$2" grep --no-color -nI -iwE "$GUARD_WORDS" || [ $? -eq 1 ] || return 2
    git -C "$2" grep --no-color -nI -iF -e "${w}_" -e "_$w" -e "${w}s_" || [ $? -eq 1 ] || return 2
    git -C "$2" grep --no-color -nI -E "$GUARD_CAMEL" || [ $? -eq 1 ] || return 2
  fi
  return 0
}
name_guard() {
  local dir=$1 files hits gerr line f rest n out=0
  files=$(git -C "$dir" ls-files 2>/dev/null) || { echo "FAIL: $w guard could not run"; return 1; }
  [ -n "$files" ] || { echo "FAIL: $w guard could not run"; return 1; }
  gerr=$(mktemp "${TMPDIR:-/tmp}/guard-err.XXXXXX")
  # Any error text counts as a failed run: git grep exits 1 (same as "no match") on an unreadable file.
  if ! hits=$(printf '%s\n' "$files" | guard_grep files 2>"$gerr") || [ -s "$gerr" ]; then
    rm -f "$gerr"; echo "FAIL: $w guard could not run"; return 1
  fi
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [[ "$f" =~ $GUARD_EXEMPT ]] && continue
    echo "FAIL: $w identifier at $f"; out=1
  done < <(printf '%s\n' "$hits" | sort -u)
  if ! hits=$(guard_grep git "$dir" 2>"$gerr") || [ -s "$gerr" ]; then
    rm -f "$gerr"; echo "FAIL: $w guard could not run"; return 1
  fi
  rm -f "$gerr"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    f=${line%%:*}; rest=${line#*:}; n=${rest%%:*}
    [[ "$f" =~ $GUARD_EXEMPT ]] && continue
    [[ "$line" == *"$GUARD_URL"* ]] && continue
    echo "FAIL: $w identifier at $f:$n"; out=1
  done < <(printf '%s\n' "$hits" | sort -u)
  return $out
}
if [ "${GUARD:-on}" = off ]; then
  echo "guard: skipped"
else
  name_guard . || fail=1
fi

# Self-tests: the guard fails closed outside a repo and reports exactly the identifier lines in a
# scratch repo (word-boundary and `_` matches, a path hit, the exempt path and the URL skip).
gt=$(mktemp -d "${TMPDIR:-/tmp}/guard.XXXXXX")
# `|| true` inside the group: under `set -o pipefail` the pipeline would otherwise take name_guard's exit 1.
if ! { name_guard "$gt" 2>/dev/null || true; } | grep -qF "guard could not run"; then
  echo "FAIL: name guard does not fail closed outside a git repo"; fail=1
fi
W='Co''mb'
git -C "$gt" init -q && mkdir -p "$gt/scripts" \
 && printf 'see %s.py here\nsee %sined here\nx %s_dir\ny the-%s z\nhttps://%s\nis_%s=1\n%ss_dir\n%sConfig\nis%s\n' \
      "$w" "$w" "$w" desert "$GUARD_URL" "$w" "$w" "$W" "$W" > "$gt/a.md" \
 && printf '%s\n' "$w" > "$gt/scripts/migrate.py" && : > "$gt/$w-x.txt" && git -C "$gt" add -A
want=$(printf 'FAIL: %s identifier at %s\n' "$w" "$w-x.txt" "$w" a.md:1 "$w" a.md:3 "$w" a.md:4 "$w" a.md:6 "$w" a.md:7 "$w" a.md:8 "$w" a.md:9)
gout=$(name_guard "$gt" 2>&1)
[ "$gout" = "$want" ] || { echo "FAIL: name guard self-test: expected:"; echo "$want"; echo "got: $gout"; fail=1; }
# A colour-forcing git config must not hide exemptions or break line parsing.
gout=$(GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=color.ui GIT_CONFIG_VALUE_0=always name_guard "$gt" 2>&1)
[ "$gout" = "$want" ] || { echo "FAIL: name guard self-test with color.ui=always: got: $gout"; fail=1; }
# An unreadable tracked file makes git grep print an error but exit 1 ("no match"): that must not pass.
if [ "$(id -u)" != 0 ]; then
  chmod 000 "$gt/a.md"
  if ! { name_guard "$gt" 2>/dev/null || true; } | grep -qF "guard could not run"; then
    echo "FAIL: name guard passes when git grep cannot read a tracked file"; fail=1
  fi
  chmod 644 "$gt/a.md"
fi
rm -rf "$gt"

# 11. Stop line: one source (hooks/stop-line.ts), copied as the first non-blank line after the
#     frontmatter of every skill but help, exactly once; never in help. STOP_SKILLS names them.
n=$(grep -c '^export const STOP_LINE = "' hooks/stop-line.ts 2>/dev/null)
STOP_LINE=$(sed -n 's/^export const STOP_LINE = "\(.*\)"$/\1/p' hooks/stop-line.ts 2>/dev/null)
if [ "$n" != 1 ] || [ -z "$STOP_LINE" ]; then
  echo "FAIL: hooks/stop-line.ts must hold exactly one line: export const STOP_LINE = \"...\""; fail=1
else
  case "$STOP_LINE" in *'"'*|*'\'*) echo "FAIL: STOP_LINE holds a double quote or a backslash"; fail=1;; esac
  want=$(ls skills | grep -vx help | sort | tr '\n' ' ')
  have=$(sed -n "s/^export const STOP_SKILLS: readonly string\[\] = \[\(.*\)\]$/\1/p" hooks/stop-line.ts | tr -d "' " | tr ',' '\n' | sort | tr '\n' ' ')
  [ "$want" = "$have" ] || { echo "FAIL: STOP_SKILLS ($have) differs from the skills other than help ($want)"; fail=1; }
  for s in $want; do
    f=skills/$s/SKILL.md
    c=$(grep -cxF -- "$STOP_LINE" "$f")
    [ "$c" = 1 ] || { echo "FAIL: $f carries the stop line $c times (want 1)"; fail=1; }
    first=$(awk 'NR==1 && /^---$/ {fm=1; next} fm==1 && /^---$/ {fm=2; next} fm==2 && NF {print; exit}' "$f")
    [ "$first" = "$STOP_LINE" ] || { echo "FAIL: $f: the stop line is not the first non-blank line after the frontmatter"; fail=1; }
  done
  ! grep -qxF -- "$STOP_LINE" skills/help/SKILL.md || { echo "FAIL: skills/help/SKILL.md carries the stop line"; fail=1; }
fi

# Every eval case but help-overview fails when its run stopped on the token (a module that did not
# load would otherwise pass every negative grader). help is exempt: its Requirements block names it.
# The grader must be exactly this file, built from STOP_TOKEN: a last_message target, because the
# fix-auto cases' transcripts carry the token in the sub-skill file they Read.
STOP_TOKEN=$(sed -n "s/^export const STOP_TOKEN = '\([A-Z-]*\)'$/\1/p" hooks/stop-line.ts 2>/dev/null)
if [ -z "$STOP_TOKEN" ]; then
  echo "FAIL: hooks/stop-line.ts must hold one line: export const STOP_TOKEN = '...'"; fail=1
else
  want_grader=$(printf -- '---\ntype: regex\npattern: "%s"\ntarget: last_message\nmatch: not_contains\n---' "$STOP_TOKEN")
  for d in evals/*/; do
    d=${d%/}; c=$(basename "$d"); [ -d "$d/graders" ] || continue; [ "$c" = help-overview ] && continue
    g="$d/graders/module-loaded.md"
    if [ ! -f "$g" ] || [ "$(cat "$g")" != "$want_grader" ]; then
      echo "FAIL: $g missing or not the last_message not_contains grader for $STOP_TOKEN"; fail=1
    fi
  done
fi

# 12. Engine: the vendored types name the Claude Code in use (CI must match; locally a mismatch
#     warns), the module type-checks, and its tests run and pass.
# The state ref is a literal const in each file that uses it (validate reads no imported ref); the copies must agree.
runs=$(grep -h '^const RUN = ' hooks/*.ts | sort -u)
[ "$runs" = "const RUN = { plugin: 'megamaid', key: 'run' } as const" ] || { echo "FAIL: hooks/*.ts declare RUN differently: $runs"; fail=1; }
have=$(grep -l '^const RUN = ' hooks/*.ts | sort | tr '\n' ' ')
[ "$have" = "hooks/agents.ts hooks/guards.ts hooks/session.ts hooks/skill-prompt.ts hooks/usage.ts " ] || { echo "FAIL: want RUN in exactly hooks/agents.ts, hooks/guards.ts, hooks/session.ts, hooks/skill-prompt.ts, hooks/usage.ts; found: $have"; fail=1; }
MIN_TESTS=88
tv=$(sed -n '1s/^\/\/ Written by Claude Code \([0-9][0-9.]*[0-9]\)\.$/\1/p' vendor/claude-code-types/claude-code/index.d.ts 2>/dev/null)
cv=$(claude --version 2>/dev/null | sed -n '1s/^\([0-9][0-9.]*[0-9]\) (Claude Code)$/\1/p')
if [ -z "$tv" ]; then
  echo "FAIL: vendor/claude-code-types/claude-code/index.d.ts names no Claude Code version"; fail=1
elif [ "$tv" != "$cv" ]; then
  if [ -n "${CI:-}" ]; then
    echo "FAIL: vendored types are Claude Code $tv, claude --version is '$cv'"; fail=1
  else
    echo "WARN: vendored types are Claude Code $tv, this claude is '$cv'. To refresh: run 'claude --plugin-dir .' once, exit, then scripts/sync-types.sh, and commit as 'chore(types): Claude Code <version>'."
  fi
fi
if ! out=$(npx -y -p typescript@5.9.3 tsc -p . 2>&1); then echo "$out"; echo "FAIL: tsc -p ."; fail=1; fi
cfg=$(mktemp -d "${TMPDIR:-/tmp}/plugin-test.XXXXXX")
out=$(CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1); rc=$?
rm -rf "$cfg"
ran=$(printf '%s\n' "$out" | sed -nE 's/^Ran ([0-9]+) tests? across [0-9]+ files?\..*/\1/p')
if printf '%s\n' "$out" | grep -q '^claude plugin test:'; then
  printf '%s\n' "$out" | grep '^claude plugin test:'; echo "FAIL: claude plugin test refused"; fail=1
elif [ "$rc" != 0 ] || [ -z "$ran" ] || [ "$ran" -lt "$MIN_TESTS" ] || ! printf '%s\n' "$out" | grep -qx ' 0 fail'; then
  printf '%s\n' "$out" | grep -v '^(pass)'; echo "FAIL: claude plugin test (exit $rc, ran '${ran:-?}', want >= $MIN_TESTS and 0 fail)"; fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "check-contract: OK"
fi
exit "$fail"
