#!/usr/bin/env bash
# Copy the engine-written hooks-module types into vendor/claude-code-types/, the pinned copy
# that tsc and CI use. Usage: scripts/sync-types.sh [<laid types folder>]
# Default source: .claude-plugin/types, which an interactive `claude --plugin-dir .` writes.
# <laid types folder> is absolute or relative to the repo root (the script cds there first).
# Commit the result on its own: `chore(types): Claude Code X`.
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:-.claude-plugin/types}"
for d in claude-code claude-code-tools; do
  [ -f "$src/$d/index.d.ts" ] || { echo "sync-types: $src/$d/index.d.ts not found" >&2; exit 1; }
done
v=$(sed -n '1s/^\/\/ Written by Claude Code \([0-9][0-9.]*[0-9]\)\.$/\1/p' "$src/claude-code/index.d.ts")
[ -n "$v" ] || { echo "sync-types: $src/claude-code/index.d.ts has no 'Written by Claude Code X.' first line" >&2; exit 1; }
for d in claude-code claude-code-tools; do
  mkdir -p "vendor/claude-code-types/$d"
  cp "$src/$d/index.d.ts" "vendor/claude-code-types/$d/index.d.ts"
done
echo "sync-types: vendor/claude-code-types now holds Claude Code $v"
