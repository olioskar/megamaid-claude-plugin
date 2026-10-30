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
run config-latin1        config --plugin-root "$P" --home "$H" --project-root "$F/latin1"
# resolve: lane model, role model override, coercion, effort, native rule, errors
run resolve-review       resolve --role code-reviewer --lane review "${C[@]}"
run resolve-plan-ours    resolve --role ours --lane plan "${C[@]}"
run resolve-trivial      resolve --role implementer --lane fix.implementer_trivial "${C[@]}"
run resolve-planner      resolve --role planner --lane plan "${C[@]}"
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
# a fix run's X-item planner brief lands beside its implementer brief: the skill and the role are both in the name
run brief-plan-same-run  brief --skill plan --role planner --run fix-1-cccc "${C[@]}"
# a foreign writer configured as the implementer role: authority sentence, lens, implementer intro
run brief-foreign-fix-impl brief --skill fix --role implementer --run fix-1-dddd --plugin-root "$P" --home "$H" --project-root "$F/noplugin"
# a project overrides the planner with a foreign agent and no when_to_use: the lens is the shipped planner text
run brief-foreign-plan-planner brief --skill plan --role planner --run plan-1-abcd --plugin-root "$P" --home "$H" --project-root "$F/noplugin"
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
run batches-slash        batches --folder "$R/plans/slash"
# batches: a plan's **Depends on:** puts the item in a batch after its dependency; a grouped code maps to its group
run batches-deps         batches --folder "$R/plans/deps"
run batches-depgroup     batches --folder "$R/plans/depgroup"
run batches-depcycle     batches --folder "$R/plans/depcycle"
# write-set: one instruction's write-set, the same rules batches prints per item
run writeset-where       write-set --file "$R/plans/code/M1-a.md"
run writeset-files       write-set --file "$R/plans/writeset/H2-files-only.md"
run writeset-revise      write-set --file "$R/plans/revise/revise-spec.md"
run writeset-none        write-set --file "$R/plans/code/T1-e.md"
run writeset-missing     write-set --file "$R/plans/code/no-such.md"
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
for b in review-1-aaaa.review.code-reviewer plan-1-bbbb.plan.ours fix-1-cccc.fix.implementer fix-1-cccc.fix.test-auditor fix-1-cccc.plan.planner fix-1-dddd.fix.implementer plan-1-abcd.plan.planner review-1-ffff.review.code-reviewer; do
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
lay dotlink;             runn notice-dotlink             config "${LAY[@]}"
runn notice-case config --plugin-root "$P" --home "$L/same/Root" --project-root "$L/same/root"
lay paths-null;          runn notice-paths-null          config "${LAY[@]}"
lay two-layer;           runn notice-two-layer           config "${LAY[@]}"
lay manifest-dir;        runn notice-manifest-dir        config "${LAY[@]}"
ln -s "$L/via-link/project" "$T/projlink"
runn notice-via-link config --plugin-root "$P" --home "$L/via-link/home" --project-root "$T/projlink"
lay warn;                runn notice-warn                config "${LAY[@]}"
mkdir -p lone && cp "$S" lone/
python3 -I lone/megamaid.py config "${C[@]}" 2>&1 >/dev/null | norm > "$OUT2/lone.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/lone.out"
python3 -I lone/megamaid.py migrate config --layer home "${C[@]}" 2>&1 | norm > "$OUT2/lone-migrate.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT2/lone-migrate.out"
lay translate;           run2 translate         migrate config --layer project "${LAY[@]}"
lay bom;                 run2 translate-bom     migrate config --layer project "${LAY[@]}"
lay invalid;             run2 translate-badjson migrate config --layer project "${LAY[@]}"
lay list;                run2 translate-list    migrate config --layer project "${LAY[@]}"
lay effort-scalar;       run2 translate-scalar  migrate config --layer project "${LAY[@]}"
lay latin1;              run2 translate-latin1  migrate config --layer project "${LAY[@]}"
lay dotlink;             run2 translate-dotlink migrate config --layer project "${LAY[@]}"
lay home-only;           run2 translate-missing migrate config --layer project "${LAY[@]}"
lay home-only;           run2 translate-home    migrate config --layer home "${LAY[@]}"
run2 translate-same migrate config --layer project --plugin-root "$P" --home "$L/same/root" --project-root "$L/same/root"
lay manifest-default;    run2 manifest-move       migrate manifest --move "${LAY[@]}"
cat "$L/manifest-default/project/docs/megamaid/PATTERNS.md" > "$OUT2/manifest-move-content.out" 2>&1
                         run2 manifest-move-again migrate manifest --move "${LAY[@]}"
lay manifest-configured; run2 manifest-copy       migrate manifest --copy "${LAY[@]}"
cat "$L/manifest-configured/project/docs/megamaid/PATTERNS.md" > "$OUT2/manifest-copy-content.out" 2>&1
                         run2 manifest-copy-again migrate manifest --copy "${LAY[@]}"
lay kept-path;           run2 manifest-kept       migrate manifest --copy "${LAY[@]}"
lay project-only;        run2 manifest-missing    migrate manifest --copy "${LAY[@]}"
lay manifest-newnull;    run2 manifest-disabled   migrate manifest --copy "${LAY[@]}"
lay manifest-dir;        run2 manifest-dir        migrate manifest --copy "${LAY[@]}"
lay parent-file;         run2 manifest-parent-file migrate manifest --copy "${LAY[@]}"
# a move out of a read-only folder fails cleanly and leaves no second copy
chmod 555 "$L/readonly/project/docs/"*
lay readonly;            run2 manifest-readonly   migrate manifest --move "${LAY[@]}"
{ find "$L/readonly/project/docs" -type f | sed 's#.*/docs/##'; [ -e "$L/readonly/project/docs/megamaid/PATTERNS.md" ] && echo "target written" || echo "no target"; } >> "$OUT2/manifest-readonly.out" 2>&1
chmod 755 "$L/readonly/project/docs/"*
# a symlinked manifest: --move moves the manifest, never the shared file the link points to
lay linked;              run2 manifest-linked     migrate manifest --move "${LAY[@]}"
{ ls "$L/linked/shared"; cat "$L/linked/project/docs/megamaid/PATTERNS.md"; } > "$OUT2/manifest-linked-shared.out" 2>&1

# fix: a fix round's mechanical steps, on temporary git repos copied from fixtures/megamaid/fixrepo.
# Fix commands take the project root from git, so they pass only the plugin root and home; SHAs print as SHA.
FX=(--plugin-root "$P" --home "$H")
mkrepo() { rm -rf "$T/$1"; cp -R "$F/fixrepo" "$T/$1"; (cd "$T/$1" && git init -q -b main && git config user.email fixture@example.com && git config user.name Fixture && git add -A && git commit -q -m init); }
runf() { name=$1; dir=$2; shift 2; (cd "$dir" && python3 -I "$S" "$@" 2>&1) | norm | sed -E 's/[0-9a-f]{40}/SHA/g' > "$OUT/$name.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT/$name.out"; }
fstart() { (cd "$T/$1" && python3 -I "$S" fix start --folder plans/p --verify "${2:-none}" --commits "${3:-on}" "${FX[@]}" > /dev/null 2>&1); }
PY=$(python3 -c 'import sys; print(sys.executable)'); mkdir -p "$T/nobin"
(cd "$T" && PATH="$T/nobin" MEGAMAID_GIT_CANDIDATES=/nonexistent "$PY" -I "$S" fix preflight --folder plans/p "${FX[@]}" 2>&1) | norm > "$OUT/fix-nogit.out"; echo "exit=${PIPESTATUS[0]}" >> "$OUT/fix-nogit.out"
mkrepo r-pre; echo x >> "$T/r-pre/plans/p/M1-a.md"; echo n > "$T/r-pre/plans/p/notes.md"; echo r > "$T/r-pre/docs/megamaid/reviews/pr-1-round1-report.md"
runf fix-preflight-clean "$T/r-pre" fix preflight --folder plans/p "${FX[@]}"
mkrepo r-odd; mkdir -p "$T/r-odd/notes"; echo x > "$T/r-odd/notes/x y.txt"; (cd "$T/r-odd" && git mv src/b.js src/b2.js)
runf fix-preflight-oddpaths "$T/r-odd" fix preflight --folder plans/p "${FX[@]}"
mkrepo r-start
runf fix-start "$T/r-start" fix start --folder plans/p --verify "sh -c 'echo built > out.txt'" --commits on "${FX[@]}"
mkrepo r-nd; echo edit >> "$T/r-nd/src/a.js"
runf fix-start-notdispatched "$T/r-nd" fix start --folder plans/p --verify none --commits on "${FX[@]}"
mkrepo r-sub
runf fix-start-subdir "$T/r-sub/src" fix start --folder ../plans/p --verify none --commits off "${FX[@]}"
runf fix-start-subdir-gate "$T/r-sub" fix gate --folder plans/p --code M2 "${FX[@]}"
mkrepo r-gate; echo edit >> "$T/r-gate/src/a.js"; fstart r-gate
runf fix-gate-ok "$T/r-gate" fix gate --folder plans/p --code M2 "${FX[@]}"
runf fix-gate-not "$T/r-gate" fix gate --folder plans/p --code M1 "${FX[@]}"
mkrepo r-rs; fstart r-rs; (cd "$T/r-rs" && echo hand >> src/b.js && git commit -qam hand)
runf fix-resync "$T/r-rs" fix resync --folder plans/p "${FX[@]}"
(cd "$T/r-rs" && grep -q "\"head\": \"$(git rev-parse HEAD)\"" .megamaid/fix/plans-p.json && echo "state head: HEAD" || echo "state head: stale") >> "$OUT/fix-resync.out"
# fix check: the three checks after an implementer returns (HEAD, reported list, allowed set)
mkrepo r-ck; fstart r-ck; echo e >> "$T/r-ck/src/a.js"
runf fix-check-ok "$T/r-ck" fix check --folder plans/p --code M1 --reported src/a.js "${FX[@]}"
mkrepo r-ckh; fstart r-ckh; (cd "$T/r-ckh" && echo e >> src/a.js && git commit -qam implementer)
runf fix-check-head "$T/r-ckh" fix check --folder plans/p --code M1 --reported src/a.js "${FX[@]}"
mkrepo r-cku; fstart r-cku; echo e >> "$T/r-cku/src/a.js"
runf fix-check-unreported "$T/r-cku" fix check --folder plans/p --code M1 --reported "${FX[@]}"
mkrepo r-ckw; fstart r-ckw; echo e >> "$T/r-ckw/src/a.js"; echo e >> "$T/r-ckw/src/b.js"
runf fix-check-outside-where "$T/r-ckw" fix check --folder plans/p --code M1 --reported src/a.js src/b.js "${FX[@]}"
runf fix-check-batchmate "$T/r-ckw" fix check --folder plans/p --code M1 --reported src/a.js src/b.js --in-flight M2 "${FX[@]}"
mkrepo r-cka; fstart r-cka; echo e >> "$T/r-cka/src/a.js"; echo n > "$T/r-cka/src/c.js"
runf fix-check-outside-allowed "$T/r-cka" fix check --folder plans/p --code M1 --reported src/a.js "${FX[@]}"
mkrepo r-cks; fstart r-cks; echo e >> "$T/r-cks/src/a.js"; echo r > "$T/r-cks/docs/megamaid/reviews/pr-1-round2-report.md"; echo a >> "$T/r-cks/plans/p/M1-a.md"
runf fix-check-sweep "$T/r-cks" fix check --folder plans/p --code M1 --reported src/a.js "${FX[@]}"
mkrepo r-ckn
runf fix-check-nostate "$T/r-ckn" fix check --folder plans/p --code M1 --reported src/a.js "${FX[@]}"
# fix revert: restore the reported files, never a batch-mate's, and record the attempt in the instruction
printf 'FAIL: the loop still runs twice\n' > "$T/rev1.txt"; printf 'FAIL: off by one\nat src/a.js:1\n' > "$T/rev2.txt"
attempts() { { echo "--- attempts"; sed -n '/^## Attempts/,$p' "$T/$1/plans/p/$2"; echo "--- status"; (cd "$T/$1" && git status --porcelain); } >> "$OUT/$3.out"; }
mkrepo r-rv; fstart r-rv; echo e >> "$T/r-rv/src/a.js"; echo n > "$T/r-rv/src/new.js"
runf fix-revert "$T/r-rv" fix revert --folder plans/p --code M1 --reported src/a.js src/new.js --reviewer-file "$T/rev1.txt" "${FX[@]}"
attempts r-rv M1-a.md fix-revert
mkrepo r-rvb; fstart r-rvb; echo e >> "$T/r-rvb/src/a.js"; echo e >> "$T/r-rvb/src/b.js"
runf fix-revert-batchmate "$T/r-rvb" fix revert --folder plans/p --code M1 --reported src/a.js src/b.js --in-flight M2 --reviewer-file "$T/rev1.txt" "${FX[@]}"
attempts r-rvb M1-a.md fix-revert-batchmate
mkrepo r-rvd; fstart r-rvd; rm "$T/r-rvd/src/a.js"
runf fix-revert-deleted "$T/r-rvd" fix revert --folder plans/p --code M1 --reported src/a.js --reviewer-file "$T/rev1.txt" "${FX[@]}"
attempts r-rvd M1-a.md fix-revert-deleted
mkrepo r-rv2; fstart r-rv2; echo e >> "$T/r-rv2/src/a.js"
(cd "$T/r-rv2" && python3 -I "$S" fix revert --folder plans/p --code M1 --reported src/a.js --reviewer-file "$T/rev1.txt" "${FX[@]}" > /dev/null 2>&1)
echo e2 >> "$T/r-rv2/src/a.js"
runf fix-revert-second "$T/r-rv2" fix revert --folder plans/p --code M1 --reported src/a.js --reviewer-file "$T/rev2.txt" --plan-change "How now loops once" "${FX[@]}"
attempts r-rv2 M1-a.md fix-revert-second
# fix verify: the recorded command against the start baseline; a new failure attributed to a write-set
mkdir -p "$T/vs"; vs() { printf '%s\n' "$2" > "$T/vs/$1.sh"; }
vs green 'exit 0'; mkrepo r-vg; fstart r-vg "sh $T/vs/green.sh"
runf fix-verify-green "$T/r-vg" fix verify --folder plans/p --waiting M1 "${FX[@]}"
vs red 'echo "FAIL test/x.test.js"; exit 1'; mkrepo r-vu; fstart r-vu "sh $T/vs/red.sh"
runf fix-verify-unchanged "$T/r-vu" fix verify --folder plans/p --waiting M1 "${FX[@]}"
vs att 'exit 0'; mkrepo r-va; fstart r-va "sh $T/vs/att.sh"; vs att 'echo "FAIL src/a.js:3 expected 1"; exit 1'
runf fix-verify-attributed "$T/r-va" fix verify --folder plans/p --waiting M2 --reviewing M1 "${FX[@]}"
vs una 'exit 0'; mkrepo r-vn; fstart r-vn "sh $T/vs/una.sh"; vs una 'echo "FAIL test/x.test.js"; echo "1 failing"; exit 1'
runf fix-verify-unattributed "$T/r-vn" fix verify --folder plans/p --waiting M1 --reviewing M2 "${FX[@]}"
vs sil 'exit 0'; mkrepo r-vs; fstart r-vs "sh $T/vs/sil.sh"; vs sil 'echo oops; exit 1'
runf fix-verify-silent-red "$T/r-vs" fix verify --folder plans/p --waiting M1 "${FX[@]}"
mkrepo r-v0; fstart r-v0
runf fix-verify-none "$T/r-v0" fix verify --folder plans/p --waiting M1 "${FX[@]}"
# fix commit: stage and commit the reported files; with commits off, snapshot them as finished
m3() { sed 's/^# M1 — Fix a/# M3 — Fix a again/' "$T/$1/plans/p/M1-a.md" > "$T/$1/plans/p/M3-c.md"; }
fx() { dir=$1; shift; (cd "$T/$dir" && python3 -I "$S" fix "$@" --folder plans/p "${FX[@]}" > /dev/null 2>&1); }
mkrepo r-cm; fstart r-cm; echo e >> "$T/r-cm/src/a.js"
runf fix-commit "$T/r-cm" fix commit --folder plans/p --code M1 --title "Fix a" --reported src/a.js "${FX[@]}"
runf fix-commit-then-check "$T/r-cm" fix check --folder plans/p --code M2 --reported "${FX[@]}"
(cd "$T/r-cm" && git log -1 --format=%s; git status --porcelain) >> "$OUT/fix-commit.out"
mkrepo r-cme; fstart r-cme
runf fix-commit-empty "$T/r-cme" fix commit --folder plans/p --code M1 --title "Fix a" --reported "${FX[@]}"
mkrepo r-cmh; (cd "$T/r-cmh" && git config core.hooksPath .git/hooks && printf '#!/bin/sh\necho rejected >&2\nexit 1\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit); fstart r-cmh; echo e >> "$T/r-cmh/src/a.js"
runf fix-commit-hook "$T/r-cmh" fix commit --folder plans/p --code M1 --title "Fix a" --reported src/a.js "${FX[@]}"
mkrepo r-cmr; mkdir -p "$T/r-cmr/plans/r"; echo '# Spec' > "$T/r-cmr/docs/spec.md"
printf '# Revise spec\n\n**Target spec:** `docs/spec.md`\n' > "$T/r-cmr/plans/r/revise-spec.md"
(cd "$T/r-cmr" && git add -A && git commit -qm setup && python3 -I "$S" fix start --folder plans/r --verify none --commits on "${FX[@]}" > /dev/null 2>&1); echo more >> "$T/r-cmr/docs/spec.md"
runf fix-commit-revise "$T/r-cmr" fix commit --folder plans/r --code revise-spec --title "ignored" --reported docs/spec.md "${FX[@]}"
(cd "$T/r-cmr" && git log -1 --format=%s) >> "$OUT/fix-commit-revise.out"
mkrepo r-off; fstart r-off none off; echo m1 >> "$T/r-off/src/a.js"
runf fix-commit-off "$T/r-off" fix commit --folder plans/p --code M1 --title "Fix a" --reported src/a.js "${FX[@]}"
m3 r-off
runf fix-check-off-later-none "$T/r-off" fix check --folder plans/p --code M3 --reported "${FX[@]}"
echo m3 >> "$T/r-off/src/a.js"
runf fix-check-off-later "$T/r-off" fix check --folder plans/p --code M3 --reported src/a.js "${FX[@]}"
runf fix-check-off-later-unreported "$T/r-off" fix check --folder plans/p --code M3 --reported "${FX[@]}"
printf 'FAIL\n' > "$T/rev3.txt"
runf fix-revert-off-later "$T/r-off" fix revert --folder plans/p --code M3 --reported src/a.js --reviewer-file "$T/rev3.txt" "${FX[@]}"
cat "$T/r-off/src/a.js" >> "$OUT/fix-revert-off-later.out"
mkrepo r-rso; fstart r-rso none off; echo m1 >> "$T/r-rso/src/a.js"; fx r-rso commit --code M1 --title "Fix a" --reported src/a.js; m3 r-rso
(cd "$T/r-rso" && echo hand >> src/b.js && git commit -qm hand -- src/b.js)
runf fix-resync-off "$T/r-rso" fix resync --folder plans/p "${FX[@]}"
runf fix-resync-off-check "$T/r-rso" fix check --folder plans/p --code M3 --reported "${FX[@]}"
# a Step 3 group runs as one item: --code M1+M2 is the union of their write-sets; the attempt lands in each file
mkrepo r-grp; fstart r-grp; echo e >> "$T/r-grp/src/a.js"; echo e >> "$T/r-grp/src/b.js"
runf fix-group-check "$T/r-grp" fix check --folder plans/p --code M1+M2 --reported src/a.js src/b.js "${FX[@]}"
runf fix-group-revert "$T/r-grp" fix revert --folder plans/p --code M1+M2 --reported src/a.js src/b.js --reviewer-file "$T/rev1.txt" "${FX[@]}"
grep -c '^### Attempt 1 — FAIL' "$T/r-grp/plans/p/M1-a.md" "$T/r-grp/plans/p/M2-b.md" | sed 's#.*/##' >> "$OUT/fix-group-revert.out"
# review fixes: literal pathspecs, the user's D0 never touched, symlinked absolute paths, verify's edge cases
mkrepo r-br; mkdir -p "$T/r-br/app/[id]" "$T/r-br/app/d"; echo p > "$T/r-br/app/[id]/page.tsx"; echo p > "$T/r-br/app/d/page.tsx"
sed 's#src/a.js#app/[id]/page.tsx#g; s/^# M1 — Fix a/# M3 — Bracketed route/' "$T/r-br/plans/p/M1-a.md" > "$T/r-br/plans/p/M3-r.md"
(cd "$T/r-br" && git add -A && git commit -qm routes); echo user >> "$T/r-br/app/d/page.tsx"; fstart r-br; echo m3 >> "$T/r-br/app/[id]/page.tsx"
cp -R "$T/r-br" "$T/r-br2"
runf fix-bracket-revert "$T/r-br" fix revert --folder plans/p --code M3 --reported "app/[id]/page.tsx" --reviewer-file "$T/rev1.txt" "${FX[@]}"
(cd "$T/r-br" && git status --porcelain -- app) >> "$OUT/fix-bracket-revert.out"
runf fix-bracket-commit "$T/r-br2" fix commit --folder plans/p --code M3 --title "Route" --reported "app/[id]/page.tsx" "${FX[@]}"
(cd "$T/r-br2" && git show --name-only --format=%s HEAD; git status --porcelain -- app) >> "$OUT/fix-bracket-commit.out"
mkrepo r-d0; fstart r-d0; (cd "$T/r-d0" && echo hand >> src/a.js && git commit -qam hand); echo wip >> "$T/r-d0/src/b.js"
runf fix-resync-notdispatched "$T/r-d0" fix resync --folder plans/p "${FX[@]}"
runf fix-check-d0 "$T/r-d0" fix check --folder plans/p --code M2 --reported src/b.js "${FX[@]}"
runf fix-revert-d0 "$T/r-d0" fix revert --folder plans/p --code M2 --reported src/b.js --reviewer-file "$T/rev1.txt" "${FX[@]}"
grep -c wip "$T/r-d0/src/b.js" >> "$OUT/fix-revert-d0.out"
runf fix-commit-d0 "$T/r-d0" fix commit --folder plans/p --code M2 --title "Fix b" --reported src/b.js "${FX[@]}"
mkrepo r-dir; fstart r-dir; echo e >> "$T/r-dir/src/a.js"; echo e >> "$T/r-dir/src/b.js"
runf fix-revert-dir-mate "$T/r-dir" fix revert --folder plans/p --code M1 --reported src --in-flight M2 --reviewer-file "$T/rev1.txt" "${FX[@]}"
(cd "$T/r-dir" && git status --porcelain -- src) >> "$OUT/fix-revert-dir-mate.out"
mkrepo r-abs; fstart r-abs; echo e >> "$T/r-abs/src/a.js"
runf fix-check-abs "$T/r-abs" fix check --folder plans/p --code M1 --reported "$TL/r-abs/src/a.js" "${FX[@]}"
runf fix-revert-outside "$T/r-abs" fix revert --folder plans/p --code M1 --reported src/a.js ../outside.js --reviewer-file "$T/rev1.txt" "${FX[@]}"
grep -c e "$T/r-abs/src/a.js" >> "$OUT/fix-revert-outside.out"
vs emp 'exit 0'; mkrepo r-ve; fstart r-ve "sh $T/vs/emp.sh"; vs emp 'exit 1'
runf fix-verify-silent-empty "$T/r-ve" fix verify --folder plans/p --waiting M1 "${FX[@]}"
vs ex 'echo "FAIL test/x.test.js"; exit 1'; mkrepo r-vx; fstart r-vx "sh $T/vs/ex.sh"; vs ex 'echo "FAIL test/x.test.js"; exit 2'
runf fix-verify-exit-changed "$T/r-vx" fix verify --folder plans/p --waiting M1 "${FX[@]}"
vs tm 'echo "FAILED tests/test_x.py::test_a"; echo "==== 1 failed, 3 passed in 0.87s ===="; exit 1'; mkrepo r-vt; fstart r-vt "sh $T/vs/tm.sh"
vs tm 'echo "FAILED tests/test_x.py::test_a"; echo "==== 1 failed, 3 passed in 1.02s ===="; exit 1'
runf fix-verify-timing "$T/r-vt" fix verify --folder plans/p --waiting M1 "${FX[@]}"
vs many 'exit 0'; mkrepo r-vm; fstart r-vm "sh $T/vs/many.sh"; vs many 'i=1; while [ $i -le 60 ]; do echo "error $i"; i=$((i+1)); done; exit 1'
runf fix-verify-many "$T/r-vm" fix verify --folder plans/p --waiting M1 "${FX[@]}"

fail=0
check() {  # $1 output dir, $2 expected dir; an expected file with no output is stale
  for x in "$2"/*; do
    [ -e "$1/$(basename "$x")" ] && continue
    if [ "$UPDATE" = 1 ]; then rm -f "$x"; else echo "FAIL: stale expected file $(basename "$x") (no case produces it)"; fail=1; fi
  done
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
