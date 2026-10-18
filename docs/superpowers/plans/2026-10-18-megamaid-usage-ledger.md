# Phase 2: usage ledger — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hooks module records what each megamaid run costs per role from `turn.complete` and writes a Markdown usage ledger: beside the review report for `review` and `vacu-suck`, under `.megamaid/usage/` for every other run.

**Architecture:** One new pure module (`hooks/ledger.ts`: fold, key, path, render) and one new event module (`hooks/usage.ts`: a `turn.complete` observer that attributes usage to the orchestrator or a recorded agent and writes the ledger, and a `tool.call{tool=Write}` observer that finds the review report). The run record grows usage fields; nested spawns are attributed to their parent's role. No skill, shared, agent or script text changes.

**Tech Stack:** TypeScript hooks module against the vendored Claude Code 2.1.299 types (`tsc` via `npx typescript@5.9.3`, `claude plugin test`), bash gates (`scripts/check-contract.sh`, `scripts/test-replay.sh`), Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-18-megamaid-usage-ledger-design.md` (rev 2). Review: `docs/megamaid/reviews/2026-10-18-phase2-spec-review.md`.

**Reference build:** the spec review's code lens built rev 1 in `/private/tmp/claude-501/-Users-olafur-Development-megamaid-claude-plugin/8a215adc-878a-4860-847b-525f4c4a74a3/scratchpad/spec-review-code/megamaid` (validate passed, check-contract OK, 46 tests). Its files are a proven starting point for every body below; each task names where rev 2 differs from it. Never copy a file without applying the task's deltas; write each test first and see it fail.

## Global Constraints

- Branch `feat/v0.4.0-usage-ledger` off `main` at `d532d83`; `main` changes only through the PR. Commit per task; push only on the maintainer's go (not in this session).
- One commit per task, `type(scope): summary`; commit messages end with the session's Co-Authored-By / Claude-Session lines.
- Every check is written first and seen to fail, then made to pass, in the same task and commit.
- Free gates on every commit: `claude plugin validate .` and `bash scripts/check-contract.sh`. No paid run anywhere in this plan (maintainer, 2026-10-18): no `claude plugin eval`, no `scripts/smoke.sh`, no `claude -p`.
- Observers refuse nothing: every new hook awaits `next(e)` first, returns its result by reference, and ends in `.catch(($, e, next) => next(e))`.
- The state ref is `const RUN = { plugin: 'megamaid', key: 'run' } as const`, declared in each file that writes state; `hooks/usage.ts` gets its own.
- Exact strings (spec, Decisions "Ledger format"): title `# megamaid usage: <qualified skill>`; `Run: started <ISO>, last turn <ISO or none yet> (UTC)`; `Cost: <n.nn> USD (session spend from run start to the last counted turn; includes anything else in the session meanwhile)` or `Cost: unavailable (no session cost at run start or now)`; table header `| Lane/role | Agents | Turns | Input | Cache read | Cache write | Output | Model |`; orchestrator row first with `Agents` cell `-`; `total` row with `Model` empty; `Orchestrator share: <N>% of input tokens, <M>% of output tokens.`
- Debug log lines: `usage <key> +<input>/<output> (<turns>)` (input = the turn's three input counts summed), `ledger <path>` on every write, `ledger failed: <message>`, `<lane>/<role> nested spawn <subagentType> (<agentId>) under <parent>`.
- `REPORT_SKILLS = ['megamaid:review', 'megamaid:vacu-suck']`; `REPORT_NAME = /^(pr-\d+|branch-.+)-round\d+-report\.md$/`; `report` is set once per run.
- Version 0.4.0. Prose plain; no knobs. `docs/` is git-ignored: spec, plan and handover edits are local only.

## Review Focus

Input classes the spec implies but its own test list does not pin; each gets a test in the owning task.

1. A sweep's second round: a second report Write in the same run must not move the ledger (`report` set once). Task 3.
2. A `turn.complete` with `usage` whose `agentId` was recorded in an earlier run (stale id after a new run started): must count nowhere. Task 2.
3. Two agents under one key answered by different models: the row's Model lists both, comma-joined, first-seen order. Task 1.
4. A report path with backslashes (Windows spelling) still places the ledger beside it. Task 3.
5. `fs.exists` throwing (not only `fs.write`): the state write must stand and `ledger failed:` logged. Task 2.

---

### Task 1: types, pure ledger helpers, run fields

**Files:**
- Modify: `types/index.d.ts`
- Create: `hooks/ledger.ts`
- Create: `hooks/ledger.test.ts`
- Modify: `hooks/run.ts` (`startRun`, import `ZERO`)
- Modify: `hooks/agents.ts:24-30` (pass `parent: null, usage: null`)

**Interfaces:**
- Produces: `MegamaidUsage`, `MegamaidAgent.parent`, `MegamaidAgent.usage`, `MegamaidRun.usage|report|costAtStart|lastTurnAt` (types as in the spec, Changes/Types); `ZERO: MegamaidUsage`; `REPORT_SKILLS`; `REPORT_NAME`; `addUsage(u: MegamaidUsage, t: TurnUsage): MegamaidUsage`; `usageKey(agent: MegamaidAgent): string`; `reportName(path: string): boolean`; `ledgerPath(run: MegamaidRun): string | null`; `renderLedger(run: MegamaidRun, costNow: number | null): string`; `startRun(id, skill, startedAt, costAtStart: number | null = null)`.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/v0.4.0-usage-ledger main
```

- [ ] **Step 2: Write `hooks/ledger.test.ts`**

Start from the reference build's `hooks/ledger.test.ts` and apply the rev 2 deltas: the title assertion is `# megamaid usage: megamaid:review`; the `Cost:` assertions are the exact rev 2 strings (`Cost: 2.50 USD (session spend from run start to the last counted turn; includes anything else in the session meanwhile)` and `Cost: unavailable (no session cost at run start or now)`); the `total` row's Model cell is empty (`| total | 4 | 7 | 350 | 1000 | 50 | 100 |  |`); add to the first test an agent `a5` with `role: 'simplifier'` and `usage: u(1, 0, 0, 0, 0, 'n')` and expect the simplifier row's Model `m, n` (Review Focus 3); keep the `0%`, rounding, `addUsage`, `usageKey`, `reportName` and `ledgerPath` tests (including `none-5.md`).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cfg=$(mktemp -d); CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1 | tail -5`
Expected: the file fails to load (`./ledger` not found) or every ledger test fails; the 29 existing tests pass.

- [ ] **Step 4: Write `types/index.d.ts`, `hooks/ledger.ts`, and the `run.ts` / `agents.ts` changes**

Types exactly as the spec's Changes/Types block. `hooks/ledger.ts` from the reference build with these deltas: title `# megamaid usage: ${run.skill}`; the two `Cost:` strings above; `sum` keeps `model` out and the render collects distinct models per key in first-seen order (`models: string[]` on the row; cell `models.join(', ')`, `-` when empty, empty for `total`). `startRun` gains the fourth parameter and the new fields (`usage: ZERO`, `report: null`, `lastTurnAt: null`); `agents.ts`'s `addAgent` call passes `parent: null, usage: null`.

- [ ] **Step 5: Run the tests and tsc**

Run: `npx -y -p typescript@5.9.3 tsc -p . && cfg=$(mktemp -d); CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1 | tail -3`
Expected: tsc silent; `Ran 36 tests across 6 files`, ` 0 fail` (29 + 7).

- [ ] **Step 6: Commit**

```bash
git add types/index.d.ts hooks/ledger.ts hooks/ledger.test.ts hooks/run.ts hooks/agents.ts
git commit -m "feat(hooks): usage types and pure ledger helpers"
```

---

### Task 2: attribution and the ledger write

**Files:**
- Modify: `hooks/test-rig.ts`
- Create: `hooks/usage.ts`
- Create: `hooks/usage.test.ts`
- Modify: `hooks/skill-prompt.ts:16` (costAtStart)
- Modify: `hooks/register.ts`
- Modify: `scripts/check-contract.sh:344-346` (§12 RUN list, `MIN_TESTS`)

**Interfaces:**
- Consumes: Task 1's helpers.
- Produces: `registerUsage(on: On): void` (the `turn.complete` hook; the Write hook comes in Task 3); `writeLedger($: Pick<CoreEngineInterface, 'fs' | 'session' | 'ui'>, run: MegamaidRun): Promise<void>`; rig additions `fsWrites: [string, string][]`, `files: Record<string, string>`, `exists: Set<string>`, `cost: number | null` (default 3.5), `failWrites: boolean`, `failExists: boolean`, option `usage?: boolean`; `turnInput(over?: Partial<TurnCompleteInput>): TurnCompleteInput`.

- [ ] **Step 1: Extend `hooks/test-rig.ts`**

From the reference build: `fsWrites`/`files` recorder on `fs.write` (answers `{ deny: 'disk full' }` while `failWrites`), `fs.exists` answer from `exists` (answers `{ deny: 'no stat' }` while `failExists`), `session.usage` answer from `cost` unless `usage: false`, `turn.complete` answer `({ text: e.answer })`, the `/.megamaid/` prefix strip, and `turnInput`. Keep the comment that says why the strip exists (the kit resolves relative paths against the plugin folder before a test hook sees them).

- [ ] **Step 2: Write `hooks/usage.test.ts` (this task's eight tests)**

From the reference build's `usage.test.ts`, the tests: orchestrator attribution with the no-run control; recorded agent attribution with the unrecorded-id control and two turns summing (log lines `usage review/code-reviewer +1110/50 (1)` and `+6/4 (2)`); no-usage turn writes nothing; plan run writes `.megamaid/.gitignore` then `.megamaid/usage/plan-1000.md`, no second `.gitignore` once it exists (ordered `fsWrites`); cost line `Cost: 2.50 USD`; `usage: false` gives `costAtStart` null and `Cost: unavailable`; denied `fs.write` leaves the state write and logs `ledger failed: `. Rev 2 deltas: the log assertion is `ledger .megamaid/usage/plan-1000.md` and appears once per write (two after two turns); no `ledger written` line anywhere. Add: a stale agent id (Review Focus 2): start `megamaid:review`, spawn `a1` with a review brief, start `megamaid:plan`, then `turn.complete({ agentId: 'a1' })` writes nothing, and a main-loop turn still does (control). Add: `failExists` set during a plan run: the state write lands (`usage.turns` 1), `ledger failed: ` is logged, and `fsWrites` is empty (Review Focus 5).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cfg=$(mktemp -d); CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1 | grep -c '(fail)'`
Expected: a non-zero count (the module is not registered, so no state write and no file); tsc may also fail on the missing `./usage` import once register.ts is edited, which is the same evidence.

- [ ] **Step 4: Write `hooks/usage.ts` (turn.complete only), `skill-prompt.ts`, `register.ts`**

`usage.ts` from the reference build minus its Write hook (Task 3) and minus the `written` set: `writeLedger` logs `ledger ${path}` after every successful write. The `turn.complete` hook: `await next(e)`; return if `e.usage` undefined; `$.state.get(RUN)`; return if no run, or `e.agentId` set and not in `stored.agents`; `now = await $.clock.now()`; `update` adds the turn (`addUsage`) to `run.usage` or the agent's and sets `lastTurnAt: now`; log `usage <key> +<in>/<out> (<turns>)`; `writeLedger`. `skill-prompt.ts`: `const usage = await $.session.usage().catch(() => undefined)` inside the `try`, `startRun(…, usage?.cost?.usd ?? null)`. `register.ts`: `registerUsage(on)` after `registerAgents(on)`.

- [ ] **Step 5: Update check-contract §12**

The RUN list line becomes `hooks/agents.ts hooks/session.ts hooks/skill-prompt.ts hooks/usage.ts ` (and its FAIL message); `MIN_TESTS=45` (29 + 7 + 9). Run `bash scripts/check-contract.sh` once before this edit to see §12 fail on the new RUN const (`want RUN in exactly …; found: … hooks/usage.ts`), then edit.

- [ ] **Step 6: Run the gates**

Run: `claude plugin validate . 2>&1 | grep -E 'hooks:|gating|Validation' && bash scripts/check-contract.sh`
Expected: validate lists `turn.complete` among register.ts's hooks and still passes; `check-contract: OK` with `Ran 45 tests`.

- [ ] **Step 7: Commit**

```bash
git add hooks/test-rig.ts hooks/usage.ts hooks/usage.test.ts hooks/skill-prompt.ts hooks/register.ts scripts/check-contract.sh
git commit -m "feat(hooks): usage per turn, ledger under .megamaid/usage"
```

---

### Task 3: the report site

**Files:**
- Modify: `hooks/usage.ts` (add the Write hook)
- Modify: `hooks/usage.test.ts` (three tests)
- Modify: `scripts/check-contract.sh` (§5: report-name shape check)

**Interfaces:**
- Consumes: `reportName`, `REPORT_SKILLS`, `writeLedger`.
- Produces: `run.report` set once by the main loop's first report Write in a review or sweep run.

- [ ] **Step 1: Write the tests**

From the reference build: the review-run test (no file before the report; non-report name, subagent Write, denied and errored Writes set none; the report Write places `…-usage.md` beside it and the next turn rewrites it; the log filter now checks `ledger ` lines equal `[LEDGER, LEDGER]`) and the outside-a-review-run test (plan run sets none; `vacu-suck` sets `pr-12-round2-report.md`). Add to the review-run test: a second Write of `/w/docs/megamaid/reviews/branch-x-round2-report.md` leaves `report` at round 1 and writes the ledger again at the round-1 path (Review Focus 1). Add: a vacu-suck run whose report Write is `C:\\w\\reviews\\pr-3-round1-report.md` places the ledger at `C:\\w\\reviews\\pr-3-round1-usage.md` (Review Focus 4).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cfg=$(mktemp -d); CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1 | grep '(fail)'`
Expected: the three new tests fail (`report` stays null; no file).

- [ ] **Step 3: Add the Write hook to `hooks/usage.ts`**

From the reference build, with one delta: the `update` keeps an existing report (`run.report ?? path`), and the hook returns before the update when `stored.report !== null`. Order of checks: `e.tool !== 'Write' || e.agentId !== undefined` → `r.deny`/`r.isError` → `reportName(path)` → stored run in `REPORT_SKILLS` with `report === null` → update → `writeLedger`.

- [ ] **Step 4: Write the §5 check, see it fail, make it pass**

In `scripts/check-contract.sh` §5, after the `megamaid.py" findings` line: extract the pattern with `sed -n "s/^export const REPORT_NAME = \/\(.*\)\/$/\1/p" hooks/ledger.ts` (fail if empty); in a `mktemp -d` folder run `python3 -I scripts/megamaid.py report-name --reviews "$d" --pr 7` and `… --branch feat/x`, take the basename of each `report:` line, and require `grep -Eq` against the pattern for both; require `pr-7-round1-usage.md` not to match. Message on failure: `FAIL: hooks/ledger.ts REPORT_NAME does not match megamaid.py report-name output`. Seen to fail first by running the check against a tree where `ledger.ts`'s pattern is temporarily `^x$` (edit, run, revert).

- [ ] **Step 5: Run the gates**

Run: `claude plugin validate . 2>&1 | grep -E 'gating|Validation' && bash scripts/check-contract.sh`
Expected: `gating hook with .catch: tool.call{tool=Write}` listed; `check-contract: OK`, `Ran 48 tests`. Bump `MIN_TESTS` to 48 in the same commit.

- [ ] **Step 6: Commit**

```bash
git add hooks/usage.ts hooks/usage.test.ts scripts/check-contract.sh
git commit -m "feat(hooks): ledger beside the review report"
```

---

### Task 4: nested spawns

**Files:**
- Modify: `hooks/agents.ts:12-15`
- Modify: `hooks/agents.test.ts:66-75`
- Modify: `hooks/usage.test.ts` (one test)

**Interfaces:**
- Produces: a spawn with `parentAgentId` equal to a recorded agent's id is recorded with the parent's `role`, `lane`, `runStem` and `parent: parentAgentId`.

- [ ] **Step 1: Rewrite the agents test and add the usage test**

`agents.test.ts`: the test "a subagent's spawn is ignored" becomes the reference build's "a spawn nested in an unrecorded agent is ignored (controls: …)" (nested `Explore` under `a2` recorded as `review/simplifier` with `parent: 'a2'`, the log line, a brief in a nested prompt not re-keying, `parentAgentId: 'nobody'` ignored). `usage.test.ts`: the reference build's "a nested agent's turn counts under the parent's key" (fix run, `review/code-reviewer` row `| review/code-reviewer | 2 | 2 | 200 | 2000 | 20 | 100 | claude-opus-5-5 |`, total row with empty Model `| total | 2 | 2 | 200 | 2000 | 20 | 100 |  |`, `0%` shares).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cfg=$(mktemp -d); CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1 | grep '(fail)'`
Expected: both fail (nested spawn not recorded).

- [ ] **Step 3: Change `hooks/agents.ts`**

As the reference build: when `e.parentAgentId` is set, read the run; if the parent is recorded, `update` with `addAgent(run, agentId, { subagentType, provider, role: p.role, lane: p.lane, runStem: p.runStem, parent: parentId, usage: null })` (re-read inside the updater; return the run unchanged if the parent vanished), log the nested line, return; else return. Update the file's header comment.

- [ ] **Step 4: Run the gates**

Run: `bash scripts/check-contract.sh`
Expected: `check-contract: OK`, `Ran 49 tests`. Bump `MIN_TESTS` to 49 in the same commit.

- [ ] **Step 5: Commit**

```bash
git add hooks/agents.ts hooks/agents.test.ts hooks/usage.test.ts scripts/check-contract.sh
git commit -m "feat(hooks): attribute nested spawns to the parent role"
```

---

### Task 5: eval graders and replay fixtures

**Files:**
- Create: `evals/noncode-shortcircuit/graders/usage-ledger.md`
- Create: `evals/plan-native-planner/graders/usage-ledger.md`
- Create: `scripts/fixtures/replay/noncode-pass/home/cwd/docs/megamaid/reviews/branch-feature-round1-usage.md` (empty)
- Create: `scripts/fixtures/replay/plan-pass/home/cwd/.megamaid/usage/plan-1760000000000.md` (empty)
- Modify: `scripts/test-replay.sh` (three expectations)
- Modify: `evals/README.md` (the two case rows)

- [ ] **Step 1: Add the expectations to `scripts/test-replay.sh`, see them fail**

noncode-pass gains `"✓ usage-ledger: docs/megamaid/reviews/*-usage.md exists"`; plan-pass gains `"✓ usage-ledger: .megamaid/usage/plan-*.md exists"`; plan-fail gains `"✗ usage-ledger: .megamaid/usage/plan-*.md not found"`. Run: `bash scripts/test-replay.sh`. Expected: three `missing` FAIL lines.

- [ ] **Step 2: Write the graders and fixture files**

Each grader: `---\ntype: file_exists\npath: "<glob>"\n---` with the globs above. Check `git status` shows the empty fixture files (git tracks empty files; the `.megamaid/` folder is inside a fixture, not the repo root, and the repo's `.gitignore` does not ignore it: confirm with `git check-ignore -v` and add a `!` rule only if it does).

- [ ] **Step 3: Run the replay test and the gate**

Run: `bash scripts/test-replay.sh && bash scripts/check-contract.sh`
Expected: `test-replay: OK`; `check-contract: OK`.

- [ ] **Step 4: Update `evals/README.md`**

The `noncode-shortcircuit` and `plan-native-planner` rows name the `usage-ledger` grader; one sentence under Status: the two `usage-ledger` graders are verified by replay only until the next suite run, with the two assumptions (relative `$.fs.write` in the sandbox; dot-directory glob).

- [ ] **Step 5: Commit**

```bash
git add evals/noncode-shortcircuit/graders/usage-ledger.md evals/plan-native-planner/graders/usage-ledger.md scripts/fixtures/replay scripts/test-replay.sh evals/README.md
git commit -m "test(evals): usage-ledger graders, replayed offline"
```

---

### Task 6: docs and release 0.4.0

**Files:**
- Modify: `README.md:170` (How it works), `README.md:198` (Status)
- Modify: `skills/help/SKILL.md:69-84` (one line after the module paragraph)
- Modify: `PLAYBOOK.md` ("Where things live": hooks line)
- Modify: `CHANGELOG.md` (`## [0.4.0]`)
- Modify: `.claude-plugin/plugin.json` (`version`)
- Modify: `docs/handover/plan.md` (Phase 2)

- [ ] **Step 1: README and help**

README "How it works": amend the first bullet and add the ledger bullet exactly as the spec's Docs section. Help: after the `anything else … naming megamaid` rows, a blank line and the line `  Each run writes a usage ledger: beside the review report (…-usage.md) for review and vacu-suck, under .megamaid/usage/ for the other commands.` wrapped to the block's width. Run `bash scripts/check-contract.sh` (§9 still matches its `(default: X)` lines).

- [ ] **Step 2: PLAYBOOK and plan.md**

PLAYBOOK "Where things live", hooks line: the per-event list gains `usage.ts`; the pure-helper clause becomes "pure helpers without `$` live in `run.ts`, `ledger.ts` and `stop-line.ts`". plan.md Phase 2: replace the paragraph with the decided scope (what is recorded, where the ledger goes, run end, nested attribution, spec path) and "Remaining: the live loop, smoke and the suite, when the maintainer runs them."

- [ ] **Step 3: CHANGELOG, version, Status**

`## [0.4.0] — 2026-10-18`, Added: the usage ledger (what, where, the cost line, the run-end rule) and nested-spawn attribution; a line that the eval suite did not run for this release and names the two replay-only graders. `plugin.json` `version` 0.4.0; README Status `v0.4.0. See [CHANGELOG.md]…`.

- [ ] **Step 4: Run the full free gate**

Run: `claude plugin validate . && bash scripts/check-contract.sh`
Expected: `Validation passed`; `check-contract: OK`.

- [ ] **Step 5: Commit**

```bash
git add README.md skills/help/SKILL.md PLAYBOOK.md CHANGELOG.md .claude-plugin/plugin.json
git commit -m "docs(release): v0.4.0 — usage ledger"
```

---

## After the tasks

1. Branch review: two independent reviewers, read-only, briefed with the spec, the plan and `git diff main...feat/v0.4.0-usage-ledger`: a contract lens and a code-and-tests lens. Fix Critical and Important findings, each with a check that fails first; record Minor findings as deferred in the handover.
2. Handover: rewrite `docs/handover/megamaid-dev.md` (state, the open paid steps with costs: smoke 0.25 USD, suite about 6 USD, one full loop several USD; the live confirmations the spec lists), append the ledger, update memory if a durable preference surfaced.
3. Do not push. The maintainer pushes and opens the PR.
