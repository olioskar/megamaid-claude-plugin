#!/usr/bin/env bash
# Fixture test for scripts/replay-graders.py: the real graders of four eval cases, replayed
# against synthetic kept-run directories (one passing and one failing fix run, one passing
# non-code run). Deterministic and offline; run by scripts/check-contract.sh.
set -uo pipefail
cd "$(dirname "$0")/.."
F=scripts/fixtures/replay
fail=0
expect() { # <want-exit> <case> <run-dir> <want-substring>...
  local want=$1 case=$2 run=$3; shift 3
  out=$(python3 -I scripts/replay-graders.py "evals/$case" "$F/$run" 2>&1); got=$?
  [ "$got" -eq "$want" ] || { echo "FAIL: $case vs $run exited $got, want $want"; echo "$out"; fail=1; }
  for s in "$@"; do
    grep -qF -- "$s" <<<"$out" || { echo "FAIL: $case vs $run: missing \"$s\""; echo "$out"; fail=1; }
  done
}
expect 0 fix-reviewer-diff-scope fix-pass \
  "✓ fix-started: Bash called 1x" "✓ fix-checked: Bash called 2x" "✓ fix-verified: Bash called 2x" \
  "✓ m1-committed" "✓ m2-committed" "✓ overrides-listed" \
  "✓ reviewer-brief-delivered: Agent called 2x" "✓ reviewer-never-head-tilde: Agent called 0x" "✓ m1-applied" "✓ m2-applied" \
  "replay: fix-reviewer-diff-scope — OK"
expect 1 fix-reviewer-diff-scope fix-fail \
  "✗ fix-started: Bash called 0x" "✗ fix-checked: Bash called 0x" "✗ fix-verified: Bash called 0x" \
  "✗ m1-committed" "✗ m2-committed" "✗ overrides-listed" \
  "✗ reviewer-never-head-tilde: Agent called 1x" "✗ m1-applied" \
  "replay: fix-reviewer-diff-scope — FAIL"
expect 0 noncode-shortcircuit noncode-pass \
  "✓ announces-shortcircuit" "✓ design-doc-untouched: Write called 0x" "✓ no-edits: Edit called 0x" \
  "✓ no-plan-files: docs/megamaid/plans/*/*.md absent as expected" \
  "✓ usage-ledger: docs/megamaid/reviews/*-usage.md exists"
expect 0 plan-native-planner plan-pass \
  "✓ planner-dispatched: Agent called 2x" "✓ brief-delivered: Agent called 2x" "✓ native-form" \
  "✓ m1-file-written" "✓ m2-file-written" "✓ util-untouched" "✓ config-untouched" \
  "✓ no-edit: Edit called 0x" "✓ medium-label" "✓ no-missing" "✓ no-unexpected" "✓ next-names-fix" \
  "✓ no-stray-file: docs/megamaid/plans/plan-for-pr-1-round1-report/[!M]*.md absent as expected" \
  "✓ usage-ledger: .megamaid/usage/plan-*.md exists" \
  "replay: plan-native-planner — OK"
expect 1 plan-native-planner plan-fail \
  "✗ planner-dispatched: Agent called 0x" "✗ m2-file-written" "✗ util-untouched" \
  "✗ no-edit: Edit called 1x" "✗ medium-label" "✗ no-missing" "✗ no-stray-file: 1 file(s) match" \
  "✗ usage-ledger: .megamaid/usage/plan-*.md not found" \
  "replay: plan-native-planner — FAIL"
# manifest-slice: only the ledger grader is replayable from a ledger alone; the case's other graders fail here.
expect 1 manifest-slice review-sonnet-pass "✓ ledger-sonnet: matched"
expect 1 manifest-slice review-sonnet-fail "✗ ledger-sonnet: pattern not found"
[ "$fail" -eq 0 ] && echo "test-replay: OK"
exit "$fail"
