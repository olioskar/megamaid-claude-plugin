# Call-time guarantees: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hooks that refuse a megamaid agent's out-of-bounds call at the moment it is made (write boundaries, the fix reviewer's diff base, brief-to-agent fit) and set the configured model at spawn, plus the baseline's four small fixes.

**Architecture:** `hooks/agents.ts` keeps the one `agent.spawn` registration and gains, for a main-loop briefed spawn, a `megamaid.py resolve` call (brief fit, model) and the write boundary it stores on the agent's record. A new `hooks/guards.ts` registers `tool.call` guards for Edit, Write and Bash that read that record. Pure rules live in a new `hooks/guard-rules.ts`. `megamaid.py` gains `write-set`.

**Tech Stack:** TypeScript hooks module (Claude Code 2.1.303 types, `claude plugin test`), Python 3 stdlib script, bash fixture tests.

**Spec:** [2026-10-28-call-time-guarantees.md](2026-10-28-call-time-guarantees.md). Read it first; this plan does not repeat its reasons.

**Status:** the maintainer's go 2026-10-29 ("continue"); tasks 1–11 built and committed (b75e440..ed23d58), free gates green; branch review next.

## Global Constraints

- Vendored types are Claude Code 2.1.303; tsc is `typescript@5.9.3` via check-contract; no package.json.
- A function that takes `$` lives in the file that registers the hook (validate). Imports between hook files are extensionless.
- One `agent.spawn` registration (`agents.ts`). Every state write goes through `update($, RUN, fn)`. Every file that reads or writes state declares `const RUN = { plugin: 'megamaid', key: 'run' } as const`; check-contract §12's file list follows.
- New guards' `.catch`: `tool.call` → `next.called ? next(e) : e.agentId === undefined ? next(e) : { deny: '<rule> (megamaid guard fault)' }`; `agent.spawn` → `next.called ? next(e) : e.parentAgentId === undefined && parseBrief(e.prompt) !== null ? { deny: 'megamaid: brief check (megamaid guard fault)' } : next(e)`.
- Guards act only on a recorded agent (`tool.call`) or a main-loop spawn naming a run brief (`agent.spawn`). No main-loop guard. Deviation from spec part 5, which names any briefed spawn: a nested spawn is left to the existing nested flow (no fit check, no model, no boundary), because a reviewer's nested Explore whose prompt quotes its brief path would otherwise be refused as a misfit.
- A model the Agent call names wins (`e.model !== undefined` is left alone).
- Script: `python3 -I <$.plugin.root>/scripts/megamaid.py …` through `$.process.run(argv)` (session cwd, default timeout).
- LF line endings; commits `type(scope): summary`, by path (`git add PATHS && git commit -- PATHS`); no push.
- Each task's check is written first and seen to fail.

## Review Focus

1. A path spelled differently from `Repository:` (a symlinked root such as `/tmp` → `/private/tmp`, `./`, `..`) names the same file and is allowed. Test in Task 4.
2. A directory entry in a write-set (`src/x`) allows `src/x/y.ts` and refuses the prefix sibling `src/xy.ts`. Test in Task 4.
3. An implementer prompt without `Instruction file:` or `Repository:`, or a `write-set` exit 2, refuses every edit with a reason that says why; it never leaves the agent unguarded. Test in Task 4.
4. A main-loop Edit, an unrecorded agent's Edit (another plugin's, the user's), and a recorded reviewer's Edit all pass while a run with a boundary is stored. Test in Task 4.
5. A briefed spawn whose `resolve` exits 2 (role not in config) passes, keeps its model, and logs one debug line. Test in Task 6.

## Files

| File | Change |
|---|---|
| `scripts/megamaid.py` | `paths_in` drops tokens with no letter or digit; new `write-set --file` subcommand; docstring |
| `scripts/test-megamaid.sh`, `scripts/fixtures/megamaid/project/plans/{slash,writeset}/`, `scripts/fixtures/megamaid/expected/` | fixture cases |
| `types/index.d.ts` | `MegamaidAgent.boundary?: MegamaidBoundary \| null` |
| `hooks/guard-rules.ts` (new, pure) | prompt fields, lane mapping, resolve parsing, path rules, deny texts |
| `hooks/agents.ts` | resolve, brief fit, model fill, boundary on the record; new `.catch` |
| `hooks/guards.ts` (new) | `tool.call` Edit, Write, Bash guards |
| `hooks/register.ts` | `registerGuards(on)` |
| `hooks/test-rig.ts` | `process.run` answer, `answerRealpaths`, `seedRun` |
| `hooks/guards.test.ts` (new), `hooks/agents.test.ts`, `hooks/guard-rules.test.ts` (new) | tests |
| `agents/implementer.md`, `agents/planner.md`, `shared/dispatch-delivery.md`, `shared/plan-brief.md`, `shared/fix-reviewer-brief.md`, `skills/{review,plan,fix}/SKILL.md` | prose per the spec's Prose table and parts 7, 8 |
| `scripts/check-contract.sh` | §12 RUN file list; `MIN_TESTS` |
| `docs/api/hook-events.md`, `docs/api/scripts.md`, `docs/architecture/hooks-module.md`, `docs/architecture/design-rules.md`, `docs/features/{fix,plan,review}.md`, `docs/knowledge/engine.md` | docs |
| `evals/{dispatch-delivery,manifest-slice,plan-native-planner}/graders/model-passed.md` (deleted), `evals/manifest-slice/{scaffold.sh,graders/ledger-sonnet.md}`, `scripts/test-replay.sh`, `scripts/fixtures/replay/review-sonnet-{pass,fail}/`, `evals/README.md` | graders |

---

### Task 1: Probe (paid, under 0.10 USD, on the maintainer's word)

No repo change except `docs/knowledge/engine.md`.

- [x] **Steps 1–3: ran 2026-10-29 on the maintainer's word, 0.007 USD, Claude Code 2.1.312.** A scratch plugin `probe`: `agents/writer.md` (tools `Write`, frontmatter `model: sonnet`); `agent.spawn` hook rewrote `model: 'haiku'`, ran `$.process.run(['python3', '-I', '-c', …])`, stat'ed a missing path and `/tmp`; a `tool.call {tool:'Write'}` guard denied every subagent Write, beside a second `{tool:'Write'}` registration. Seen: `subagentType: "probe:writer"`; process exit 0, cwd the session's; `r.model: "claude-haiku-5-5"` over the frontmatter's sonnet; the subagent read the deny as `<tool_use_error>probe-deny: …</tool_use_error>`; `$.fs.stat` of a missing path throws `HooksError: … failed: ENOENT`; `/tmp` resolves to `/private/tmp`; validate lists two `tool.call{tool=Write}` gating hooks from one module.
- [ ] **Step 4:** Write those facts into engine.md (Runtime rows `machine (2.1.312)`, the `$.process.run` row's `unverified` replaced; the second-registration fact in the validate table). Commit `docs(engine): probe process.run, spawn model rewrite and subagent deny`.

### Task 2: `paths_in` drops a bare `/` (MM-046)

**Files:** `scripts/megamaid.py:581`, `scripts/test-megamaid.sh`, new `scripts/fixtures/megamaid/project/plans/slash/G7-g.md`, new `expected/batches-slash.out`.

- [ ] **Step 1:** Fixture `G7-g.md` with `## Where` holding the baseline's shape: ``Touch `tools/build.py` and `tools/viewer.html` (`names` / `targets`), then `tools/photo.py` // the loader.`` Add `run batches-slash batches --folder "$R/plans/slash"`; write `expected/batches-slash.out` by hand: `shape: per-finding`, `write-set G7: tools/build.py tools/viewer.html tools/photo.py`, `not-reproduced: none`, `batch 1: G7`, `exit=0`.
- [ ] **Step 2:** `scripts/test-megamaid.sh` fails on `batches-slash` (the set holds `/` and `//`).
- [ ] **Step 3:** In `paths_in`, skip a token after normalisation that has no `[A-Za-z0-9]`.
- [ ] **Step 4:** `scripts/test-megamaid.sh` passes, every other expected file unchanged.
- [ ] **Step 5:** Commit `fix(scripts): write-sets drop a token with no letter or digit`.

### Task 3: `megamaid.py write-set --file`

**Interfaces:** Produces `megamaid.py write-set --file <instruction>` → stdout one line `write-set: <path> …` or `write-set: (none)`; exit 2 `megamaid.py: <path>: <os error>` when unreadable. A basename matching `REVISE_FILE` reads `**Target spec:**`; any other reads `write_set_of` (## Where, else File(s)). The same logic `cmd_batches` uses; `cmd_batches` calls the shared helper `item_write_set(name, text)`.

- [ ] **Step 1:** Cases in `test-megamaid.sh`: `writeset-where` (`plans/code/M1-a.md` → `write-set: src/a.ts`), `writeset-files` (new `plans/writeset/H2-files-only.md`, no `## Where`, `**File(s):** `src/x.ts`, `lib/`` → `write-set: src/x.ts lib`), `writeset-revise` (`plans/revise/revise-spec.md` → its Target spec), `writeset-none` (`plans/code/T1-e.md` → `write-set: (none)`), `writeset-missing` (→ exit 2). Expected files by hand.
- [ ] **Step 2:** Test fails (unknown subcommand).
- [ ] **Step 3:** Implement `cmd_write_set(a)` and `item_write_set(name, text)`; add the parser and the docstring paragraph.
- [ ] **Step 4:** `scripts/test-megamaid.sh` passes; `batches-*` unchanged. Add the row to `docs/api/scripts.md`.
- [ ] **Step 5:** Commit `feat(scripts): write-set prints one instruction's write-set`.

### Task 4: Write boundaries for the implementer and the planner (parts 1, 2)

**Files:** `types/index.d.ts`, new `hooks/guard-rules.ts`, `hooks/agents.ts`, new `hooks/guards.ts`, `hooks/register.ts`, `hooks/test-rig.ts`, new `hooks/guards.test.ts`, new `hooks/guard-rules.test.ts`, `scripts/check-contract.sh` (§12 list), `agents/implementer.md`, `agents/planner.md`, `skills/fix/SKILL.md` (4a).

**Interfaces (produced):**
- `types/index.d.ts`: `export type MegamaidBoundary = { kind: 'write-set' | 'output-file'; root: string | null; paths: string[]; note: string | null }`; `MegamaidAgent.boundary?: MegamaidBoundary | null`.
- `guard-rules.ts`: `field(prompt: string, label: string): string | null` (first `^<label>:\s*(.+?)\s*$` line); `normalize(path: string): string` (lexical: `.`, `..`, repeated and trailing `/`); `within(rel: string, entries: readonly string[]): boolean` (equal, or under `entry + '/'`); `parseWriteSet(stdout: string): string[] | null` (`write-set: (none)` → `[]`, no such line → null); `denyOutsideWriteSet(file, paths)`, `denyEmptyWriteSet(note)`, `denyOutsideOutputFile(file, output)`: strings, each stating the rule and "stop, change nothing more, and report it as a divergence".
- `test-rig.ts`: `Rig.process: (argv: readonly string[]) => { exitCode: number; stdout: string; stderr?: string }`, default `() => ({ exitCode: 2, stdout: '', stderr: 'megamaid.py: role x is not in agents' })`, answered on `process.run`; `answerRealpaths(on, links: Record<string, string>, missing: readonly string[] = [])` (a prefix in `links` is rewritten; a path in or under `missing`, matched after that rewrite, answers `{ deny: 'ENOENT' }`; anything else resolves to itself, unnormalised); `seedRun(on, run: MegamaidRun)`.

Spawn side (`agents.ts`, main-loop briefed spawn, computed before `next(e)`, stored on the record after): lane `fix` + role `implementer` → `root = field('Repository')`, `instruction = field('Instruction file')`; either missing → `{ kind: 'write-set', root, paths: [], note: 'the prompt names no Instruction file or Repository line' }`; else run `write-set --file <instruction>`, exit 0 → `paths = parseWriteSet(stdout)`, otherwise `paths: []`, `note` = the stderr's first line. Lane `plan` + role `planner` → `output = field('Output file')`, relative ones joined on `field('Repository')`; missing → `paths: []` with a note. Any other agent → `boundary: null`. Nested records get no boundary.

Guard side (`guards.ts`, `registerGuards(on)`, `tool.call {tool:'Edit'}` and `{tool:'Write'}`): pass when `e.agentId === undefined`, the agent is unrecorded, or its `boundary` is null/absent. One helper, `realPath($, p): Promise<string>` in `guards.ts`, applied to the target, the root and the output file alike: stat `normalize(p)` with `{ resolve: true }`; when that throws (ENOENT, probed) or has no `realPath`, resolve the nearest existing parent the same way and append the rest; when none resolves, `normalize(p)`; the result is normalised. Write-set: relative = real target under real root + `/`; allowed when `within(relative, paths)`. Output file: allowed when real target equals `realPath(output)`. Empty `paths` → `denyEmptyWriteSet(note)`.

- [ ] **Step 1: `guard-rules.test.ts`:** `normalize('/r/./a//b/../c/')` is `/r/a/c`; `within('src/x/y.ts', ['src/x'])` true, `within('src/xy.ts', ['src/x'])` false, `within('src/a.ts', ['src/a.ts'])` true; `field` reads `Repository: /r` and returns null when absent; `parseWriteSet('write-set: a b\n')` is `['a','b']`, `'write-set: (none)\n'` is `[]`, `''` is null.
- [ ] **Step 2: `guards.test.ts`** (each seeds a run whose agent `a1` is a fix implementer with `boundary { kind: 'write-set', root: '/r', paths: ['src/a.ts', 'src/dir'], note: null }` and answers the tool with a plain result):
  - `an implementer edit inside its write-set passes` (`/r/src/a.ts`, `/r/src/dir/n.ts`)
  - `an implementer edit outside its write-set is denied with the write-set named` (`/r/src/b.ts`, `/r/src/dirx.ts`; `deny` contains `src/a.ts src/dir` and `report it as a divergence`)
  - `a symlinked spelling of the root is the same file` (`answerRealpaths({'/tmp/r': '/private/r'})`, root `/tmp/r`, edit `/private/r/./src/a.ts` passes)
  - `an empty write-set denies every edit and says the instruction is defective`
  - `a planner writes only its output file` (`boundary { kind: 'output-file', root: '/r', paths: ['/r/plans/M1-a.md'] }`; that path passes, `/r/src/a.ts` denied)
  - `a planner's first write into a folder that does not exist yet passes` (links `{'/tmp/r': '/private/r'}`, `missing: ['/private/r/plans/plan-for-x']`, output `/tmp/r/plans/plan-for-x/M1-a.md`, target `/private/r/plans/plan-for-x/M1-a.md`)
  - `an implementer creating a file in a new folder inside a directory entry passes` (`missing: ['/r/src/dir/new']`, `/r/src/dir/new/x.ts`)
  - `main-loop, unrecorded and unbounded calls pass` (no `agentId`; `agentId: 'zz'`; a recorded `fix/code-reviewer` with `boundary: null`)
  - `a throwing guard denies a subagent's call and passes a main-loop call` (`state.get` answers `{ deny: 'x' }`)
- [ ] **Step 3: `agents.test.ts`:** `an implementer spawn stores its write-set` (rig.process answers `write-set: src/a.ts` for argv containing `write-set`; prompt carries `Repository: /r` and `Instruction file: /r/plans/M1-a.md`; record has the boundary; argv[0..1] are `python3`, `-I`, argv[2] ends with `/scripts/megamaid.py`, the rest is `write-set --file /r/plans/M1-a.md`); `an implementer spawn without an Instruction file line stores an empty write-set with a note`; `a write-set exit 2 stores an empty write-set with the stderr line`; `a planner spawn stores its output file, a relative one joined on Repository`; `a reviewer spawn stores no boundary`.
- [ ] **Step 4:** `claude plugin test .` fails on the new tests.
- [ ] **Step 5:** Implement the type, `guard-rules.ts`, the spawn side, `guards.ts`, `register.ts`. Add `hooks/guards.ts` to §12's RUN file list.
- [ ] **Step 6:** `claude plugin validate .` passes and lists the new gating hooks (a second `tool.call {tool:'Write'}` beside usage.ts's is accepted on 2.1.312, Task 1; CI's 2.1.303 validate confirms it before merge, and if it refuses, the Edit and Write guards become one registration matched `{ tool: ['Edit', 'Write'] }`, any-of per `index.d.ts:5940`). `scripts/check-contract.sh` ends `check-contract: OK`.
- [ ] **Step 7: Prose:** implementer.md's `## Where` bullet → one line: edits outside `## Where` are refused by a hook; report a divergence. planner.md's first Boundaries bullet → writes other than the output file are refused; drop "elsewhere nothing checks". Fix 4a: an item whose write-set is `(none)` is announced `{code} — not dispatched: the instruction names no file` instead of dispatched.
- [ ] **Step 8:** Commit `feat(hooks): refuse an implementer's or planner's write outside its boundary`.

### Task 5: The fix reviewer never diffs past HEAD (part 3)

**Interfaces:** `guard-rules.ts`: `pastHead(command: string): boolean` (`/HEAD[~^]/`); `DENY_PAST_HEAD` string giving `git diff HEAD -- <files reported by implementer>`. `guards.ts`: `tool.call {tool:'Bash'}`, denies when the recorded agent's lane is `fix`, role is not `implementer`, and `pastHead(String(e.command))`.

- [ ] **Step 1: Tests:** `a fix reviewer's git diff HEAD~1 is denied` (also `HEAD^`); `git diff HEAD -- src/a.ts passes`; `an implementer's and a review-lane reviewer's HEAD~1 pass`; `an unrecorded agent's and the main loop's HEAD~1 pass`; `a throwing Bash guard denies a subagent's call`.
- [ ] **Step 2:** Tests fail. **Step 3:** Implement. **Step 4:** `claude plugin test .` and check-contract pass.
- [ ] **Step 5: Prose:** plan-brief.md's `Check:` line gains "a `Check:` never diffs past `HEAD`".
- [ ] **Step 6:** Commit `feat(hooks): refuse a fix reviewer's diff past HEAD`.

### Task 6: The brief fits the agent (part 5)

**Interfaces:** `guard-rules.ts`: `laneFor(brief: Brief, prompt: string): string | null` (review → `review`; plan → `plan`; fix + implementer → `fix.implementer_<trivial|standard>` from `^Class:\s*(trivial|standard)\s*$`, standard when absent; fix + other → `fix.reviewer`; anything else null); `parseResolve(stdout): { subagentType: string; model: string } | null`; `rolesFor(configJson: string, subagentType: string): string[]` (sorted config roles whose `subagent_type` equals it); `denyMisfit(brief, expected, actual, roles, root)`. `agents.ts`: `resolveBrief($, brief, lane, coerce)` runs `resolve --role <role> --lane <lane>` plus `--coerce vacu_suck` when the stored run's skill is `megamaid:vacu-suck`; returns the parse or null on a non-zero exit (logged `resolve <lane>/<role> exited <n>: <stderr line>`, to debug). A null `laneFor` means no resolve, no fit check and no model. Only on a misfit, `agents.ts` runs `python3 -I <root>/scripts/megamaid.py config` for `rolesFor`; a non-zero exit or unparsable JSON still denies, with the role list `none`.

- [ ] **Step 1: Tests:** `a brief dispatched to the agent config names passes` (resolve answers `subagent_type: megamaid:planner`, spawn `megamaid:planner`); `a planner dispatched with the implementer brief is denied` (MM-044's shape; reason names `megamaid:implementer`, the roles config maps to `megamaid:planner` from a `config` answer, and `megamaid.py brief`); `a resolve exit 2 passes the spawn and logs it`; `a foreign override resolving to general-purpose passes as general-purpose`; `a throwing spawn hook denies a briefed spawn and passes a briefless one` (the existing patterns-run briefless spawn with `state.get` refused); laneFor's five mappings and the vacu-suck `--coerce` argv. 'five spawns raised at once all land' (agents.test.ts:113) holds only the `state.get` reads made after `next` (the coerce read before it would otherwise take the five holds), so it still exercises `update`'s retry.
- [ ] **Step 2:** Fail. **Step 3:** Implement; replace agents.ts's `.catch` with the Global Constraints one. **Step 4:** test, validate, check-contract pass.
- [ ] **Step 5:** Commit `feat(hooks): refuse a spawn whose brief is for another agent`.

### Task 7: Model at spawn (part 4)

**Interfaces:** Consumes `resolveBrief` and `laneFor` (Task 6). When `e.model === undefined` and the parse is non-null, `next({ ...e, model: parsed.model })`.

- [ ] **Step 1: Tests:** `a briefed spawn without a model gets config's` (the answer reaching the test's `agent.spawn` hook has `model` from resolve, per lane: review, plan, fix.implementer_trivial with `Class: trivial`, fix.implementer_standard without a Class line, fix.reviewer); `vacu-suck coerces`; `a briefed spawn that names a model keeps it`; `a briefless spawn keeps its model`.
- [ ] **Step 2:** Fail. **Step 3:** Implement. **Step 4:** test, check-contract pass.
- [ ] **Step 5: Prose:** each briefed dispatch's "Pass `model:` as the Agent call's `model`" (review :155, plan :222, fix :207, :259, and fix's X-item planner) → pass a model only when the user named one for this run, otherwise the hook sets config's; `effort:` unchanged. dispatch-delivery's Model paragraph says the same for briefed dispatches and keeps the current rule for briefless ones. Fix 4d's prompt template gains `Class: {trivial|standard}`.
- [ ] **Step 6:** Commit `feat(hooks): set the configured model on a briefed spawn`.

### Task 8: Fix pre-flight ignores the run's own output (part 7, MM-045)

- [ ] **Step 1: Check:** `grep -c 'paths.reviews' skills/fix/SKILL.md` prints 0 before and 2 after (Step 1's list, Step 1.5's rule).
- [ ] **Step 2:** Step 1 also reads `paths.reviews`; Step 1.5 ignores the run's own paths (Step 1.6) and anything under `paths.reviews` before asking.
- [ ] **Step 3:** check-contract passes. Commit `fix(skills): fix pre-flight ignores the run's own reports and plans`.

### Task 9: A requested change is a FAIL (part 8, MM-048)

- [ ] **Step 1: Check:** `grep -c 'never PASS with' shared/fix-reviewer-brief.md` and `grep -c 'orchestrator never edits a file in a write-set' skills/fix/SKILL.md` print 0.
- [ ] **Step 2:** The reviewer brief's decision rule: a reviewer that wants any change to the diff returns FAIL with it, never PASS with a note; `DISCOVERED` and `Unverified:` are not change requests. Fix Ground rules gain "the orchestrator never edits a file in a write-set, except to revert an attempt (4f); a change goes through an implementer".
- [ ] **Step 3:** Both greps print 1; check-contract passes (§3 needles). Commit `fix(skills): a fix reviewer's requested change is a FAIL`.

### Task 10: Docs and the test floor

- [ ] **Step 1:** hook-events.md (registrations; drop "No hook refuses or rewrites a tool call"; the `agent.spawn` row; the new `tool.call` rows; the debug lines), hooks-module.md (registration count, failure-shape rows for the guards, `agent.spawn` as guard; the report-Write Bounds row's status becomes "prose only; no guard covers it", dropping "MM-025 would"), design-rules.md ("Guards fail closed" and "Observers refuse nothing" rows list them; drop "No hook returns `deny`"), features fix/plan/review where a user sees a refusal, hooks-module Bounds rows from the spec's Bounds.
- [ ] **Step 2:** `MIN_TESTS` to the `N pass` that `claude plugin test .` prints. `CHANGELOG.md` `[Unreleased]`: Added (the guards: write boundaries, diff past HEAD, brief fit; the model set at spawn; `megamaid.py write-set`), Changed (briefed dispatches no longer pass `model` unless the user named one), Fixed (MM-044, MM-045, MM-046, MM-048), each bullet with what a user sees.
- [ ] **Step 3:** check-contract passes. Commit `docs(hooks): the call-time guards`.

### Task 11: Graders follow the model off the dispatch (spec task 6)

Deviation from the spec's first choice, which the spec provides for: `scripts/replay-graders.py:131-137` reads a `regex` file target with `os.path.join` and `open`, no glob, so a plan ledger (`.megamaid/usage/plan-<startedAt>.md`) cannot be matched. The grader goes to `manifest-slice`, a review whose ledger has a fixed path.

- [ ] **Step 1:** Delete the three `model-passed.md`; drop them from evals/README.md's table. `manifest-slice/scaffold.sh` writes `.claude/megamaid.config.json` `{ "agents": { "code-reviewer": { "model": "sonnet" } } }` (one role, so the other reviewers keep their model; `deep_merge` keeps `subagent_type`, `resolve` reads `agents.R.model` first). New `manifest-slice/graders/ledger-sonnet.md`: `type: regex`, `target: { source: file, path: docs/megamaid/reviews/branch-feature-round1-usage.md }`, `pattern: '\| review/code-reviewer \|[^\n]*claude-sonnet'` (Model is the last column, `ledger.ts:87`).
- [ ] **Step 2:** Fixtures `scripts/fixtures/replay/review-sonnet-pass/` and `-fail/` (a `home/cwd/` ledger with and without a sonnet reviewer row, and an empty `out/trace.jsonl`); `test-replay.sh` expects exit 1 for both with `✓ ledger-sonnet` and `✗ ledger-sonnet`. Run it: fails before the grader file exists, passes after.
- [ ] **Step 3:** check-contract passes. Commit `test(evals): grade the configured model in the ledger, not on the dispatch`.

## Review log

Round 1 (2026-10-29): the probe could not tell a rewrite from inheritance → ran with `model: sonnet` in the agent file (Task 1); a planner's first Write lands in a folder that does not exist → one `realPath` helper walking to the nearest existing parent, two missing-folder tests; the concurrency test's holds → after `next` only; misfit `config` call, null lane → stated; main-loop narrowing → recorded as a deviation; Task 5 unrecorded and main-loop cases; the report-Write Bounds row; Task 8's target; one type name and an argv suffix assertion; one reviewer on sonnet instead of the lane; CHANGELOG entries in Task 10.

Round 2 (2026-10-29): all eleven closed; the missing-folder planner test now spells its output under the linked root, `missing` matched after the rewrite; probe facts marked 2.1.312, CI's 2.1.303 validate confirms the second Write registration, with an array-matcher fallback. Re-checked: none open.

## After the tasks (dev-flow 6–7)

Branch review by fresh subagents (contract; code and tests), findings fixed with a check that failed first. Free gates. Paid, each on the maintainer's word: smoke (about 0.25 USD), the full suite before the PR (about 5 USD).
