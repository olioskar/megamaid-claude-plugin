#!/usr/bin/env bash
# Release-gate greps for the comb plugin's shipped contract.
# Deterministic and offline; run from anywhere.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

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
for skill in review plan fix patterns the-desert fix-auto configure; do
  grep -Fq 'megamaid.py" config' "skills/$skill/SKILL.md" || { echo "FAIL: skills/$skill does not invoke megamaid.py config"; fail=1; }
done
for skill in review plan fix; do
  grep -Fq 'megamaid.py" brief' "skills/$skill/SKILL.md" || { echo "FAIL: skills/$skill does not invoke megamaid.py brief"; fail=1; }
done
grep -Fq 'megamaid.py" batches' skills/fix/SKILL.md || { echo "FAIL: skills/fix does not invoke megamaid.py batches"; fail=1; }
grep -Fq 'megamaid.py" report-name' skills/review/SKILL.md || { echo "FAIL: skills/review does not invoke megamaid.py report-name"; fail=1; }
grep -Fq 'megamaid.py" findings' skills/plan/SKILL.md || { echo "FAIL: skills/plan does not invoke megamaid.py findings"; fail=1; }
for f in skills/patterns/SKILL.md agents/pattern-scanner.md; do
  grep -Fq 'shared/scan-rules.md' "$f" || { echo "FAIL: $f does not point at shared/scan-rules.md"; fail=1; }
done
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

# Self-tests: the guard fails closed outside a repo and reports exactly the identifier lines in a
# scratch repo (word-boundary and `_` matches, a path hit, the exempt path and the URL skip).
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

if [ "$fail" -eq 0 ]; then
  echo "check-contract: OK"
fi
exit "$fail"
