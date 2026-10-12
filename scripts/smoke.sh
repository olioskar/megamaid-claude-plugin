#!/usr/bin/env bash
# Structural check plus two short claude -p help runs (a few cents); run once before a PR.
# The behavioural gate is `claude plugin eval` (see evals/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== structural gates =="
claude plugin validate .
bash scripts/check-contract.sh

echo "== help smoke (non-interactive) =="
out="$(claude -p "/megamaid:help" --plugin-dir . --allowedTools "Skill Read" 2>&1)" || {
  echo "$out"
  echo "FAIL: /megamaid:help run errored"
  exit 1
}
echo "$out" | grep -q "megamaid — code-review pipeline" || {
  echo "$out"
  echo "FAIL: /megamaid:help did not print the overview"
  exit 1
}

out="$(claude -p "/megamaid:help fix" --plugin-dir . --allowedTools "Skill Read" 2>&1)" || {
  echo "$out"
  echo "FAIL: /megamaid:help fix run errored"
  exit 1
}
echo "$out" | grep -q "Reviewer specialty is matched to the plan" || {
  echo "$out"
  echo "FAIL: /megamaid:help fix did not print the per-command detail"
  exit 1
}

echo "smoke: OK (structural gates + help lane)."
echo "For a full behavioral pass, run the eval suite (see evals/README.md)."
echo "Or drive /megamaid:review manually in a scratch repo: claude --plugin-dir $(pwd)"
