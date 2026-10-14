#!/usr/bin/env bash
# Scratch repo with a finished code-shaped review report and NO config override, so the
# shipped megamaid:planner runs. Two Medium findings on two files: two native planner
# dispatches, two instruction files. Regression target: the planner agent file itself
# (its framing, its one-file boundary, its tool restriction) and the native brief form.
set -euo pipefail
git init -q -b main .
git config user.email eval@example.com
git config user.name "megamaid eval"
mkdir -p src reviews
cat > src/util.js <<'EOF'
function parsePort(raw) {
  return parseInt(raw);
}

module.exports = { parsePort };
EOF
cat > src/config.js <<'EOF'
function loadConfig(path) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

module.exports = { loadConfig };
EOF
cat > reviews/pr-1-round1-report.md <<'EOF'
# util hardening — Round 1 Review Report

**Branch:** `feature` -> `main`
**Scope:** 2 files, +11 / -0 lines
**Reviewers:** 1 agent (megamaid:code-reviewer)
**Date:** 2026-09-01

---

## Verification Summary

| Check | Result |
|---|---|
| Tests | none configured |

---

## Verdict: **NEEDS WORK**

Two Medium findings: numeric parsing and unguarded file parsing.

---

## Findings by Severity

### Critical
None.

### High
None.

### Medium
**M1 — parseInt without radix accepts unintended bases**
*Source: code-reviewer*
File(s): `src/util.js:2`
**Verified:** Read src/util.js:1-5; confirmed `parseInt(raw)` has no radix argument.

`parsePort` calls `parseInt(raw)` without the radix. A leading-zero string can parse in an unintended base on legacy engines, and `"0x50"` parses as hex. Pass `10` explicitly: `parseInt(raw, 10)`.

**M2 — loadConfig throws an unlabelled error on a missing or malformed file**
*Source: code-reviewer*
File(s): `src/config.js:3`
**Verified:** Read src/config.js:1-6; confirmed `readFileSync` and `JSON.parse` are called with no try/catch and no path in any error.

`loadConfig` lets `ENOENT` and `SyntaxError` escape as-is, so a caller sees "Unexpected token" with no file name. Wrap both calls and rethrow with the path in the message.

### Low
None.

### Test Gaps
None.

### Deferred
None.
EOF
git add -A
git commit -qm "init with review report"
