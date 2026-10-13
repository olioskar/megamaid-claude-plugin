#!/usr/bin/env bash
# Fixture test for scripts/sync-types.sh. Runs against a temp copy of the repo layout.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
t=$(mktemp -d "${TMPDIR:-/tmp}/sync-types.XXXXXX")
mkdir -p "$t/repo/scripts" "$t/src/claude-code" "$t/src/claude-code-tools"
cp scripts/sync-types.sh "$t/repo/scripts/"
printf '// Written by Claude Code 9.8.7.\nexport {}\n' > "$t/src/claude-code/index.d.ts"
printf '// tools\n' > "$t/src/claude-code-tools/index.d.ts"

out=$(bash "$t/repo/scripts/sync-types.sh" "$t/src" 2>&1); rc=$?
[ "$rc" = 0 ] || { echo "FAIL: sync-types on a good source exited $rc: $out"; fail=1; }
[ "$out" = "sync-types: vendor/claude-code-types now holds Claude Code 9.8.7" ] || { echo "FAIL: sync-types said: $out"; fail=1; }
cmp -s "$t/src/claude-code/index.d.ts" "$t/repo/vendor/claude-code-types/claude-code/index.d.ts" || { echo "FAIL: claude-code not copied"; fail=1; }
cmp -s "$t/src/claude-code-tools/index.d.ts" "$t/repo/vendor/claude-code-types/claude-code-tools/index.d.ts" || { echo "FAIL: claude-code-tools not copied"; fail=1; }

rm "$t/src/claude-code-tools/index.d.ts"
out=$(bash "$t/repo/scripts/sync-types.sh" "$t/src" 2>&1); rc=$?
[ "$rc" = 1 ] && [[ "$out" == *"claude-code-tools/index.d.ts not found"* ]] || { echo "FAIL: missing tools file: exit $rc, $out"; fail=1; }

printf '// tools\n' > "$t/src/claude-code-tools/index.d.ts"
printf '// something else\n' > "$t/src/claude-code/index.d.ts"
out=$(bash "$t/repo/scripts/sync-types.sh" "$t/src" 2>&1); rc=$?
[ "$rc" = 1 ] && [[ "$out" == *"no 'Written by Claude Code X.' first line"* ]] || { echo "FAIL: bad first line: exit $rc, $out"; fail=1; }

rm -rf "$t"
[ "$fail" -eq 0 ] && echo "test-sync-types: OK"
exit "$fail"
