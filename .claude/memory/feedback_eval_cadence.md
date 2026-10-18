---
name: eval-cadence
description: When to run the paid claude plugin eval suite for comb, and how to debug graders without paying
metadata:
  type: feedback
---

Run the eval suite (comb, now megamaid) once per PR before merge (about 5 USD), a single `--case` for a change confined to one area, and nothing for prose-only edits or for debugging that is not about the plugin. Gates (validate, check-contract, smoke) run every commit for free. When a grader looks wrong: one `--keep-temp` run, then iterate offline with `scripts/replay-graders.py` — never re-run paid cases to test grader edits.

**Why:** On 2026-10-11 the first eight-case run cost 4.67 USD, then about 3.60 USD more went on blind re-runs while fixing my own graders. The user questioned the spend and said the point is "to understand if this plugin will work as I expect it". Recorded in PLAYBOOK "Eval cadence". See [[comb-the-desert-plugin-project]].

**How to apply:** Before proposing an eval run, check which bucket the change is in; say the cost. If a run fails, read the kept trace before changing a grader.

**Added 2026-10-11 (PR 2):** when the eval *runner* itself misbehaves (sandbox, tooling, harness), do not spend tokens debugging it — report the failure and stop. User: "if the eval run it self has issues... dont waste tokens fixing it". Only act on a result that points at the plugin, or at a grader that can be replayed offline.
