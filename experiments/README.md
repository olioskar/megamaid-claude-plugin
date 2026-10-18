# Re-baseline experiments

Paid, two-arm runs that decide whether a prompt passage earns its tokens. A passage is removed only when the treatment arm, with the passage removed, shows that the failure it guards against does not recur. Each case has the same shape as `evals/` (see `evals/README.md`) and stays out of the per-PR suite. The untested gap E1 leaves is in `issues.yaml` (area `evals`).

## Method

- The **control** arm is the plugin as shipped. The **treatment** arm is a worktree with only the passage under test removed.
- The decision is measured offline from the kept dirs. One run per arm is thin evidence, so a borderline result keeps the passage.
- Each arm's dispatch prompt names its own copy of the file under test, which confirms the treatment text is the one being exercised.
- Output lands under `experiments/results/` (gitignored).

Run one arm with:

```
PATH=/opt/homebrew/bin:$PATH claude plugin eval <plugin dir> --eval-dir experiments --case <name> \
  --scaffold --ablation none --runs 1 --allow-tools Bash Write Edit --no-publish --trust-plugin --keep-temp
```

## Results

Orchestrator Opus 5.5, reviewer lane `opus`. Total spend for the three experiments: 4.88 USD over six runs.

### E1: reviewer calibration step (`calibration-clean-diff`)

A clean, tested `clamp()` addition. The treatment deletes the "Calibrate before publishing" step from all five reviewers.

| Arm | Agents picked | Non-deferred findings | Verdict | Cost |
|---|---|---|---|---|
| control | code-reviewer, test-auditor | 1 (T1: min/max type checks untested) | APPROVE | 0.75 USD |
| treatment | code-reviewer, test-auditor | 1 (the same T1) | APPROVE | 0.84 USD |

**Decision:** no padding without the step. `code-reviewer` and `test-auditor`, the two agents the run exercises, carry no calibration step. The run picks neither `simplifier`, `silent-failure-hunter` nor `consistency-auditor`, so it is no evidence about them and they keep the step; testing them needs a clean diff that draws them (a refactor, a try/catch, a spec).

### E2: scanner dominance rule stated once (`scanner-gerrymander`)

A directive requires BEM `--` modifiers; five components follow it with 9 modifiers, and `btn.css` uses 4 single-dash modifiers consistently. Area-wide that is a minority (drift), not a dominant conflict. The treatment keeps the Classification bullets in `shared/scan-rules.md` (the rule, the area-wide denominator, the self-check) and removes the restatements: the output-format paragraph's minority sentence, the agent's step-8 minority clause, and the agent's "launder drift" bullet.

| Arm | `## Directive conflicts` in the scanner reply | How btn is handled | Cost |
|---|---|---|---|
| control | none | left out of the BEM modifier sets | 0.52 USD |
| treatment | none | named in the BEM entry as "a minority across the area" | 0.48 USD |

**Decision:** the rule stated once is enough. It lives in the Classification bullets of `shared/scan-rules.md` and nowhere else. The orchestrator's Step 6 backstops in `/megamaid:patterns`, which drop self-identified minorities and gerrymandered denominators, are a separate tier and stay.

### E3: effort `medium` vs `high` (`effort-medium`, `effort-high`)

A branch with three seeded bugs in separate files: an off-by-one loop bound, a swallowed parse error that returns `[]`, and a missing `await`. The arms differ only in `effort.review`.

| Arm | Agents (effort passed) | Seeded bugs cited | Findings | Verdict | Cost | Time |
|---|---|---|---|---|---|---|
| medium | code-reviewer, silent-failure-hunter, test-auditor (`medium` ×3) | 3 of 3 | 6 | NEEDS WORK | 1.10 USD | 118 s |
| high | the same (`high` ×3) | 3 of 3 | 9 | NEEDS WORK | 1.19 USD | 127 s |

**Outcome:** no recall difference on this fixture. `high` costs about 8% more and splits the test gaps per file (four T items against one). The shipped default stays unset, the owner's decision: the session's effort applies, and `effort.review: medium` is a safe way to save a little on reviews of this size. The run also confirms the effort path end to end: `megamaid.py resolve` prints the configured effort and every Agent call carries it.
