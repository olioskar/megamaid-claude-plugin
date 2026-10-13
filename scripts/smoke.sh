#!/usr/bin/env bash
# Run once before a PR: the free gates, then three short claude -p runs (about 0.25 USD):
# help with the module on (and proof it loaded), and review with the module off (it must stop).
# The behavioural gate is `claude plugin eval` (see evals/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== structural gates =="
claude plugin validate .
bash scripts/check-contract.sh

if claude plugin list --json 2>/dev/null | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
rows = d if isinstance(d, list) else d.get("plugins", [])
sys.exit(0 if any(str(r.get("id", "")).startswith("megamaid@") and r.get("enabled") for r in rows) else 1)'; then
  echo "WARN: an installed megamaid is enabled; it can load ahead of --plugin-dir . and be what this smoke tests."
fi

tmp="$(mktemp -d "${TMPDIR:-/tmp}/megamaid-smoke.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

not_loaded() {  # $1: stderr file. True when the engine said megamaid's module did not load.
  grep -i 'megamaid' "$1" | grep -i 'not loaded' >/dev/null  # no -q: an early exit can SIGPIPE the first grep under pipefail
}

echo "== help, module on =="
for args in "" "fix"; do
  dbg="$tmp/dbg-${args:-overview}"
  out="$(claude -p "/megamaid:help $args" --plugin-dir . --allowedTools "Skill Read" --debug-file "$dbg" 2>"$tmp/err")" || {
    echo "$out"; cat "$tmp/err"; echo "FAIL: /megamaid:help $args run errored"; exit 1
  }
  if not_loaded "$tmp/err"; then cat "$tmp/err"; echo "FAIL: megamaid's hooks module did not load"; exit 1; fi
  grep -q 'module loaded (Claude Code ' "$dbg" || { echo "FAIL: the debug log has no 'module loaded' line from megamaid"; exit 1; }
  if [ -z "$args" ]; then
    echo "$out" | grep -q "megamaid — code-review pipeline" || { echo "$out"; echo "FAIL: /megamaid:help did not print the overview"; exit 1; }
    echo "$out" | grep -q "MEGAMAID-MODULE-NOT-LOADED" || { echo "$out"; echo "FAIL: the overview has no Requirements block naming the token"; exit 1; }
  else
    echo "$out" | grep -q "Reviewer specialty is matched to the plan" || { echo "$out"; echo "FAIL: /megamaid:help fix did not print the per-command detail"; exit 1; }
  fi
done

echo "== review, module off (must stop) =="
TOKEN_LINE="$(sed -n "s/^export const TOKEN_LINE = '\(.*\)'$/\1/p" hooks/stop-line.ts)"
[ -n "$TOKEN_LINE" ] || { echo "FAIL: no TOKEN_LINE in hooks/stop-line.ts"; exit 1; }
out="$(claude -p "/megamaid:review" --plugin-dir . --settings '{"disableAllHooks":true}' \
  --disallowedTools Agent Bash Write Edit --max-budget-usd 0.3 < /dev/null 2>"$tmp/err")" || true
not_loaded "$tmp/err" || { cat "$tmp/err"; echo "FAIL: precondition: the engine did not report megamaid's module as not loaded"; exit 1; }
last="$(printf '%s\n' "$out" | awk 'NF {l = $0} END {print l}' | tr -d '`')"
[ "$last" = "$TOKEN_LINE" ] || { echo "$out"; echo "FAIL: with the module off, review did not stop on: $TOKEN_LINE"; exit 1; }

echo "smoke: OK (gates, help with the module on, review stops with it off)."
echo "For a full behavioral pass, run the eval suite (see evals/README.md)."
