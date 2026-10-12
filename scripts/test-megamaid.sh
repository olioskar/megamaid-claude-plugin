#!/usr/bin/env bash
# Fixture test for scripts/megamaid.py. Runs every subcommand against the fixture
# plugin root, home, and project under scripts/fixtures/megamaid/ from a temporary
# cwd, normalises paths, and diffs the output against scripts/fixtures/megamaid/expected/.
# Run with --update to regenerate the expected files.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
S="$ROOT/scripts/megamaid.py"
F="$ROOT/scripts/fixtures/megamaid"
E="$F/expected"
UPDATE=0; [ "${1:-}" = "--update" ] && UPDATE=1
export PYTHONUNBUFFERED=1   # stderr and stdout interleave in write order, so warnings come first by construction
T=$(mktemp -d "${TMPDIR:-/tmp}/megamaid-test.XXXXXX")
trap 'rm -rf "$T"' EXIT
OUT="$T/out"; mkdir -p "$OUT" "$E"
TR=$(cd "$T" && pwd -P)   # macOS: $TMPDIR is a symlink into /private
TL=$(cd "$T" && pwd)      # logical path (no doubled slashes from $TMPDIR)
cd "$T"

norm() { sed -E -e 's/[a-z]+-[0-9]{9,}-[0-9a-f]{4}/RUN/g' -e "s#$TR#TMP#g" -e "s#$TL#TMP#g" -e "s#$T#TMP#g" -e "s#$F#FIX#g" -e "s#$ROOT#PLUGIN#g" ; }

P="$F/plugin"; H="$F/home"; R="$F/project"
C=(--plugin-root "$P" --home "$H" --project-root "$R")
run() { name=$1; shift; python3 -I "$S" "$@" 2>&1 | norm > "$OUT/$name.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT/$name.out"; }

# config: three-layer merge, null deletes, schema warning, bad JSON
run config               config "${C[@]}"
run config-badjson       config --plugin-root "$P" --home "$H" --project-root "$F/badjson"
# resolve: lane model, role model override, coercion, effort, native rule, errors
run resolve-review       resolve --role code-reviewer --lane review "${C[@]}"
run resolve-plan-ours    resolve --role ours --lane plan "${C[@]}"
run resolve-trivial      resolve --role implementer --lane fix.implementer_trivial "${C[@]}"
run resolve-coerce       resolve --role test-auditor --lane review --coerce vacu_suck "${C[@]}"
run resolve-coerce-plain resolve --role code-reviewer --lane plan --coerce vacu_suck "${C[@]}"
run resolve-deleted      resolve --role simplifier --lane review "${C[@]}"
run resolve-badlane      resolve --role code-reviewer --lane nope "${C[@]}"
run resolve-badeffort    resolve --role fast --lane plan "${C[@]}"
run resolve-oddities     resolve --role code-reviewer --lane review --plugin-root "$P" --home "$H" --project-root "$F/oddities"
run resolve-listlane     resolve --role code-reviewer --lane review --plugin-root "$P" --home "$H" --project-root "$F/oddities2"
# directives: listing, primary matching, user directives, plugin defaults off
run directives-none      directives "${C[@]}"
run directives-simpl     directives --brief "keep it simpl" "${C[@]}"
run directives-two       directives --brief "Scope and TEST coverage" "${C[@]}"
run directives-user      directives --brief "velocity" "${C[@]}"
run directives-noplugin  directives --plugin-root "$P" --home "$H" --project-root "$F/noplugin"
run directives-short-positive directives --brief "the api" --plugin-root "$P" --home "$H" --project-root "$F/noplugin"
run directives-oddities  directives --plugin-root "$P" --home "$H" --project-root "$F/oddities"
# brief: the per-run dispatch block, written under the temp cwd's .megamaid/excerpts
touch ex.md PATTERNS.md
run brief-native-review  brief --skill review --role code-reviewer --run review-1-aaaa --brief "scope and simplicity" --excerpt "$T/ex.md" --manifest "$T/PATTERNS.md" "${C[@]}"
run brief-foreign-plan   brief --skill plan --role ours --run plan-1-bbbb --brief "keep it simpl" --manifest "$T/PATTERNS.md" "${C[@]}"
run brief-fix-impl       brief --skill fix --role implementer --run fix-1-cccc "${C[@]}"
run brief-fix-reviewer   brief --skill fix --role test-auditor --run fix-1-cccc --brief "tests" "${C[@]}"
run brief-mint           brief --skill review --role code-reviewer "${C[@]}"
run brief-missing-manifest brief --skill review --role code-reviewer --run review-1-dddd --manifest "$T/nope.md" "${C[@]}"
run brief-badrun         brief --skill review --role code-reviewer --run "not a stem" "${C[@]}"
run brief-excerpt-no-manifest brief --skill review --role code-reviewer --run review-1-eeee --excerpt "$T/ex.md" "${C[@]}"
# the X-item planner brief of a fix run must not overwrite the implementer brief (same run, same role, other skill)
run brief-plan-same-run  brief --skill plan --role implementer --run fix-1-cccc "${C[@]}"
# a foreign writer configured as the implementer role: authority sentence, lens, implementer intro
run brief-foreign-fix-impl brief --skill fix --role implementer --run fix-1-dddd --plugin-root "$P" --home "$H" --project-root "$F/noplugin"
run brief-blank-focus    brief --skill review --role code-reviewer --run review-1-ffff --brief "   " "${C[@]}"
# report-name: rounds are parsed from filenames, never counted; the prefix is exact
run report-pr            report-name --reviews "$R/reviews" --pr 7
run report-pr70          report-name --reviews "$R/reviews" --pr 70
run report-branch        report-name --reviews "$R/reviews" --branch "feature/foo bar"
run report-branch-main   report-name --reviews "$R/reviews" --branch main
run report-nodir         report-name --reviews "$R/no-such-dir" --pr 1
run report-emptybranch   report-name --reviews "$R/reviews" --branch ""
mkdir -p rvnoperm && chmod 000 rvnoperm
run report-noperm        report-name --reviews "$T/rvnoperm" --pr 1
chmod 755 rvnoperm
# batches: folder shape, write-sets, not-reproduced, disjoint batches of at most three
run batches-code         batches --folder "$R/plans/code"
run batches-revise       batches --folder "$R/plans/revise"
mkdir -p empty-folder
run batches-empty        batches --folder "$T/empty-folder"
run batches-mixed        batches --folder "$R/plans/mixed"
run batches-missing      batches --folder "$R/plans/no-such-folder"
run batches-ceiling      batches --folder "$R/plans/ceiling"
run batches-latin1       batches --folder "$R/plans/latin1"
run batches-tworevise    batches --folder "$R/plans/tworevise"
run batches-dupcode      batches --folder "$R/plans/dupcode"
mkdir -p noperm && cp "$R/plans/code/M1-a.md" noperm/ && chmod 000 noperm/M1-a.md
run batches-noperm       batches --folder "$T/noperm"
chmod 644 noperm/M1-a.md
# findings: the fixed report template as JSON; anything else is count 0, never a traceback
run findings-code        findings --report "$R/reports/code-report.md"
run findings-noncode     findings --report "$R/reports/noncode-report.md"
run findings-prose       findings --report "$R/reports/prose.md"
run findings-missing     findings --report "$R/reports/no-such-report.md"
run findings-old         findings --report "$R/reports/old-report.md"
run findings-mixed-deferred findings --report "$R/reports/mixed-deferred.md"
for b in review-1-aaaa.review.code-reviewer plan-1-bbbb.plan.ours fix-1-cccc.fix.implementer fix-1-cccc.fix.test-auditor fix-1-cccc.plan.implementer fix-1-dddd.fix.implementer review-1-ffff.review.code-reviewer; do
  if [ -f ".megamaid/excerpts/$b.brief.md" ]; then norm < ".megamaid/excerpts/$b.brief.md" > "$OUT/brief-$b.md"; else echo "MISSING .megamaid/excerpts/$b.brief.md" > "$OUT/brief-$b.md"; fi
done
[ -f .megamaid/.gitignore ] && cat .megamaid/.gitignore > "$OUT/brief-gitignore.out" || echo "MISSING .megamaid/.gitignore" > "$OUT/brief-gitignore.out"
# manifest.py clean removes a run's briefs (same stem)
python3 -I "$ROOT/scripts/manifest.py" clean --run fix-1-cccc > "$OUT/brief-clean.out" 2>&1
{ ls .megamaid/excerpts 2>/dev/null | grep -c fix-1-cccc || true; } >> "$OUT/brief-clean.out"

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
lay latin1;              runn notice-latin1              config "${LAY[@]}"
mkdir -p lone && cp "$S" lone/
python3 -I lone/megamaid.py config "${C[@]}" 2>&1 >/dev/null | norm > "$OUT2/lone.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/lone.out"
python3 -I lone/megamaid.py migrate config --layer home "${C[@]}" 2>&1 | norm > "$OUT2/lone-migrate.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/lone-migrate.out"
lay translate;           run2 translate         migrate config --layer project "${LAY[@]}"
lay bom;                 run2 translate-bom     migrate config --layer project "${LAY[@]}"
lay invalid;             run2 translate-badjson migrate config --layer project "${LAY[@]}"
lay list;                run2 translate-list    migrate config --layer project "${LAY[@]}"
lay effort-scalar;       run2 translate-scalar  migrate config --layer project "${LAY[@]}"
lay latin1;              run2 translate-latin1  migrate config --layer project "${LAY[@]}"
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
# a symlinked manifest: --move moves the manifest, never the shared file the link points to
lay linked;              run2 manifest-linked     migrate manifest --move "${LAY[@]}"
{ ls "$L/linked/shared"; cat "$L/linked/project/docs/megamaid/PATTERNS.md"; } > "$OUT2/manifest-linked-shared.out" 2>&1

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
