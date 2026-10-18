# Phase 1b: planner role — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/megamaid:plan` and fix's DISCOVERED path dispatch their planners as the role `planner` (`agents/planner.md`, `agents.planner`) instead of borrowing the fix writer role `implementer`; nothing a user sees in a plan run changes.

**Architecture:** A new agent file and config role, two skills switched to resolve and brief `planner`, the implementer agent file narrowed to fix, two new contract checks, fixtures and the one eval scaffold moved to the new role, docs. No change to `scripts/megamaid.py` (it keys on skill, not role) and no change to the hooks module (run detection reads the role from the brief path).

**Tech Stack:** Markdown skill and agent files, JSON config, bash gates (`scripts/check-contract.sh`, `scripts/test-megamaid.sh`), one TypeScript test file, Claude Code 2.1.299.

**Spec:** `docs/superpowers/specs/2026-10-14-megamaid-planner-role-design.md` (rev 2). Review: `docs/megamaid/reviews/2026-10-14-phase1b-spec-review.md`.

## Global Constraints

- Branch `feat/v0.3.0-planner-role` off `main` at `49cf2dc` or later; `main` changes only through the PR. Push only on the maintainer's go.
- One commit per task, `type(scope): summary`; commit messages end with the session's Co-Authored-By / Claude-Session lines.
- Every check is written first and seen to fail, then made to pass, in the same task and commit.
- Free gates on every commit: `claude plugin validate .` and `bash scripts/check-contract.sh` (which runs `scripts/test-megamaid.sh`, `tsc` and `claude plugin test`, 29 tests). No paid run outside "After the tasks"; say the cost before each paid run.
- Role name `planner`; subagent type `megamaid:planner`; file `agents/planner.md`. Brief file for a plan dispatch: `.megamaid/excerpts/<run>.plan.planner.brief.md`.
- Planner frontmatter line, exact: `disallowedTools: Agent, Edit, NotebookEdit`. Implementer's, exact and unchanged: `disallowedTools: Agent, NotebookEdit`.
- Planner `when_to_use`, exact: `Planner for /megamaid:plan, and for the issues /megamaid:fix discovers. Writes exactly one file per dispatch, the output file its prompt names; never edits source, never commits, never dispatches agents. Override per-project to plug in a specialist planner; the override inherits these boundaries through its run brief's `Your lens:` line. Not part of the review palette.`
- Every grep pattern in `check-contract.sh` that starts with `--` is passed with `-e`.
- `models.plan` stays `opus`; no trivial planner lane; no enforced model order.
- Prose plain; no knobs, fields or sections the spec does not name. `docs/` is git-ignored: handover and spec edits are local only.

## Review Focus

Input classes the spec implies but its test list does not exercise, most likely first. Each has a check in the owning task.

1. A project config that overrides `agents.planner` with only a `subagent_type` (no `when_to_use`): the brief's `Your lens:` must carry the shipped planner text, or a foreign planner gets no boundaries. Fixture `brief-foreign-plan-planner`, Task 3.
2. A fix run's X-item planner brief and its implementer brief share one run stem: both must exist side by side after the plan brief is written. Fixture `brief-plan-same-run`, Task 3 (`brief-clean.out` still counts 3 files).
3. A skill edit that reorders the flags (`--lane plan --role implementer`) slips the new grep: accepted and stated in the check's comment, Task 2.
4. `claude plugin validate .` accepts any `disallowedTools` text, so a typo in the planner's line would ship: §8 asserts the exact line, Task 1.
5. The `dispatch-delivery` eval's grader regex and the scaffold's override must agree with what `megamaid.py brief` prints for the planner: checked offline by running the scaffold and the brief command, Task 4. The new case's report must parse as two Medium findings: checked offline with `megamaid.py findings`, Task 4b.

---

### Task 1: planner agent, implementer narrowed, config role, §8 asserts

**Files:**
- Create: `agents/planner.md`
- Create: `scripts/fixtures/megamaid/plugin/agents/planner.md`
- Modify: `agents/implementer.md:3,8,29-32`
- Modify: `config/defaults.json:33-36`
- Modify: `scripts/fixtures/megamaid/plugin/config/defaults.json` (byte copy of the real file)
- Modify: `scripts/fixtures/megamaid/expected/config.out:18-21`
- Modify: `scripts/check-contract.sh:150-155` (§8)

**Interfaces:**
- Produces: role `planner` resolvable by `megamaid.py resolve --role planner --lane plan` (native in the real plugin and the fixture plugin); the two exact `disallowedTools` lines.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/v0.3.0-planner-role main
```

- [ ] **Step 2: Write the §8 asserts in `scripts/check-contract.sh`**

After the `done` that closes the `for f in agents/*.md; do` loop (line 155, before `for n in code-reviewer simplifier …`), insert:

```bash
# The writer roles' tool restrictions are exact lines: validate accepts any text in disallowedTools.
grep -qxF 'disallowedTools: Agent, Edit, NotebookEdit' agents/planner.md 2>/dev/null || { echo "FAIL: agents/planner.md must carry exactly 'disallowedTools: Agent, Edit, NotebookEdit'"; fail=1; }
grep -qxF 'disallowedTools: Agent, NotebookEdit' agents/implementer.md || { echo "FAIL: agents/implementer.md must carry exactly 'disallowedTools: Agent, NotebookEdit'"; fail=1; }
```

- [ ] **Step 3: See it fail**

Run: `bash scripts/check-contract.sh 2>&1 | grep -F 'FAIL:'`
Expected: `FAIL: agents/planner.md must carry exactly 'disallowedTools: Agent, Edit, NotebookEdit'` (the implementer line passes already).

- [ ] **Step 4: Create `agents/planner.md`**

```markdown
---
name: planner
description: Planner for /megamaid:plan, and for the issues /megamaid:fix discovers. Reads one review finding and the code it names, reproduces it, and writes one fix instruction file. Never part of a review palette.
model: opus
disallowedTools: Agent, Edit, NotebookEdit
---

You are the planner: a senior developer who reads the code, traces the failure, and writes instructions an implementer applies cold, in small exact steps, with nothing left to decide. The quality of the fix is decided here. The dispatch prompt names your job: one fix instruction for one finding, or one consolidated revise-doc for a prose review.

## Inputs

The dispatch prompt provides the shared context block and the files to read first, in order. For a per-finding dispatch (`/megamaid:plan` on a code-shaped report, or an issue `/megamaid:fix` discovered) those are the planner brief (`shared/plan-brief.md`: your job and the instruction file format) and the run brief (the directive paths to read, the observed-baseline block when a manifest resolved, the optional user focus brief). For a revise-doc dispatch (`/megamaid:plan` on a non-code report) the prompt carries its own job and output format and names the run brief only.

## Boundaries

- **Write exactly one file: the output file your shared context names.** Nothing else is yours to write. In a code-shaped plan run the orchestrator counts the output folder afterwards and a missing or unexpected file stops the item; elsewhere nothing checks, so the boundary is yours to keep.
- **Never edit a source file.** You describe the change; the implementer makes it. Reading, searching and `git log` or `git blame` are fine.
- **Never commit, stage, stash, reset, or check out.** The orchestrator owns git.
- **Never dispatch agents or invoke skills.** You are the leaf of the run.

## How to work

Follow the job the dispatch prompt and its shared brief give. For a per-finding dispatch that is the "What to do" steps of `shared/plan-brief.md`: read the affected files, reproduce the finding and record `Finding status`, read the nearby files, write the instruction. For a revise-doc, the prompt's own steps. Read the directives the run brief lists as most relevant; the full list is for reference.

## Output

The file is the artifact, and everything the format asks for goes in it, a structural concern included. Your reply is one or two lines: the path you wrote and, where the format has one, its `Finding status`. The orchestrator does not read the reply for content. No code in the reply.
```

- [ ] **Step 5: Narrow `agents/implementer.md`**

Line 3 becomes:

```
description: Writer agent for /megamaid:fix. Executes one fix instruction exactly as dispatched. Never part of a review palette.
```

Line 8 becomes:

```
You are the implementer. You execute one fix instruction precisely and completely.
```

Delete lines 31–32 (the sentence "When `/megamaid:plan` dispatches you, the planner brief's output format replaces this section." and the blank line after it), so `## Output format` is followed directly by `Plain text, these sections in order:`.

- [ ] **Step 6: Add the role to `config/defaults.json`**

Replace the `implementer` entry (lines 33–36) with:

```json
    "implementer": {
      "subagent_type": "megamaid:implementer",
      "when_to_use": "Writer for /megamaid:fix. Writes only inside the instruction's ## Where, never commits, stages, stashes, or dispatches agents, and reports every file it changed. Override per-project to plug in a specialist writer; the override inherits these boundaries through its run brief's `Your lens:` line. Not part of the review palette."
    },
    "planner": {
      "subagent_type": "megamaid:planner",
      "when_to_use": "Planner for /megamaid:plan, and for the issues /megamaid:fix discovers. Writes exactly one file per dispatch, the output file its prompt names; never edits source, never commits, never dispatches agents. Override per-project to plug in a specialist planner; the override inherits these boundaries through its run brief's `Your lens:` line. Not part of the review palette."
    },
```

Check: `python3 -I -c 'import json; json.load(open("config/defaults.json"))'` exits 0.

- [ ] **Step 7: Mirror into the fixture plugin**

```bash
cp config/defaults.json scripts/fixtures/megamaid/plugin/config/defaults.json
printf -- '---\nname: planner\n---\n' > scripts/fixtures/megamaid/plugin/agents/planner.md
```

- [ ] **Step 8: See the fixture test fail on `config.out`, then regenerate it**

Run: `bash scripts/test-megamaid.sh 2>&1 | tail -n 5`
Expected: a diff on `config.out` (the planner entry and the implementer `when_to_use`), and `test-megamaid: FAIL …`.

Run: `bash scripts/test-megamaid.sh --update && git diff --stat scripts/fixtures/`
Expected: only `expected/config.out` and the two fixture files from Step 7 change; the `config.out` diff is two entries, `planner` added and the implementer `when_to_use`. If any other expected file changed, stop: something else moved.

- [ ] **Step 9: Free gates**

Run: `claude plugin validate . && bash scripts/check-contract.sh`
Expected: `✔ Validation passed`, `check-contract: OK` (§8 asserts pass; `claude plugin test` 29 tests).

- [ ] **Step 10: Commit**

```bash
git add agents/planner.md agents/implementer.md config/defaults.json scripts/check-contract.sh scripts/fixtures/megamaid/plugin/agents/planner.md scripts/fixtures/megamaid/plugin/config/defaults.json scripts/fixtures/megamaid/expected/config.out
git commit -m "feat(agents): planner role, implementer narrowed to fix"
```

---

### Task 2: skills resolve the planner; §5 grep; help and shared text

**Files:**
- Modify: `scripts/check-contract.sh:107` (§5, after the `megamaid.py" findings` line)
- Modify: `skills/plan/SKILL.md:144,157,215-226`
- Modify: `skills/fix/SKILL.md:305`
- Modify: `skills/review/SKILL.md:131`
- Modify: `skills/help/SKILL.md:172-173,196-197,227`
- Modify: `shared/dispatch-delivery.md:21`

**Interfaces:**
- Consumes: role `planner` from Task 1.
- Produces: every plan dispatch resolves `--role planner --lane plan` and briefs `--skill plan --role planner`.

- [ ] **Step 1: Write the §5 check**

After line 107 (`grep -Fq 'megamaid.py" findings' skills/plan/SKILL.md || …`), insert:

```bash
# Planning resolves the planner role, never the fix writer. Patterns start with "--", so each goes
# through -e; flag order is part of the pattern (a reordered flag pair would slip past; accepted).
if grep -rqF -e '--role implementer --lane plan' -e '--skill plan --role implementer' skills/; then
  echo "FAIL: a skill plans with the implementer role; planning uses --role planner"; fail=1
fi
for skill in plan fix; do
  grep -qF -e '--role planner --lane plan' "skills/$skill/SKILL.md" || { echo "FAIL: skills/$skill/SKILL.md does not resolve the planner with --role planner --lane plan"; fail=1; }
done
```

- [ ] **Step 2: See each half fail on its own**

Run: `bash scripts/check-contract.sh 2>&1 | grep -F 'FAIL:'`
Expected, three lines:
```
FAIL: a skill plans with the implementer role; planning uses --role planner
FAIL: skills/plan/SKILL.md does not resolve the planner with --role planner --lane plan
FAIL: skills/fix/SKILL.md does not resolve the planner with --role planner --lane plan
```
Then prove the negative half fires by itself: `grep -rqF -e '--role implementer --lane plan' skills/; echo $?` prints `0` (a match), and `grep -rqF '--role implementer --lane plan' skills/; echo $?` prints `2` with `grep: unrecognized option` on stderr. That is why `-e` is there.

- [ ] **Step 3: Edit `skills/plan/SKILL.md`**

Line 144: replace `` (`megamaid.py resolve --role implementer --lane plan`, then `megamaid.py brief --skill plan --role implementer …`) `` with `` (`megamaid.py resolve --role planner --lane plan`, then `megamaid.py brief --skill plan --role planner …`) ``.

Line 157: `Read first: {run brief path printed by `megamaid.py brief` (skill plan, role implementer)}` becomes `… (skill plan, role planner)}`.

Line 215, the specialty-lens bullet: after `When no role obviously matches, default to `code-reviewer`.` insert ` Never a writer role (`implementer`, `planner`).`

Line 216: `- **Resolve the writer role** (the planner needs Write access; the `megamaid:*` review roles cannot write, and the user's `agents.implementer` override is honored):` becomes `- **Resolve the planner role** (the planner needs Write access; the `megamaid:*` review roles cannot write, and the user's `agents.planner` override is honored):`.

Line 219: `resolve --role implementer --lane plan` becomes `resolve --role planner --lane plan`.

Line 226: `brief --skill plan --role implementer --run <run> …` becomes `brief --skill plan --role planner --run <run> …`.

Check: `grep -n -w implementer skills/plan/SKILL.md` lists only lines 199, 206 and 215 (the "Notes for the implementer" heading and sentence in the revise-doc template, and the lens exclusion), nothing else.

- [ ] **Step 4: Edit `skills/fix/SKILL.md` line 305**

`Resolve the writer with `megamaid.py resolve --role implementer --lane plan`, write a planner run brief with `megamaid.py brief --skill plan --role implementer --run <run> …`` becomes `Resolve the planner with `megamaid.py resolve --role planner --lane plan`, write a planner run brief with `megamaid.py brief --skill plan --role planner --run <run> …``.

- [ ] **Step 5: Edit `skills/review/SKILL.md` line 131**

```
**`pattern-scanner`, `pattern-shaver`, `implementer` and `planner` are never eligible.** The first two are generation-only (dispatched by `/megamaid:patterns`); the last two are writer roles, and review is read-only. Exclude them from the palette regardless of diff content or focus brief.
```

- [ ] **Step 6: Edit `skills/help/SKILL.md`**

Plan section, Config knobs (lines 172–173) become:

```
  models.plan             (default: opus)   planner model; keep it strong: a good
                                            instruction lets a cheaper implementer apply it
  effort.plan             (default: unset)  planner effort (session default)
  agents.planner          (default: megamaid:planner)  the planner agent
```

Fix section, after line 197 (`  - Implementer is agents.implementer (default megamaid:implementer).`) insert:

```
  - A discovered issue is planned by agents.planner on models.plan.
```

Line 227 becomes:

```
  agents.implementer     (default: megamaid:implementer)  the fix writer agent
```

- [ ] **Step 7: Edit `shared/dispatch-delivery.md` line 21**

`(the skill is in the name so a fix run's X-item planner brief never overwrites its implementer brief)` becomes `(the skill and the role are in the name, so one run's briefs never collide)`.

- [ ] **Step 8: Free gates**

Run: `claude plugin validate . && bash scripts/check-contract.sh`
Expected: `check-contract: OK`. §5's three lines are gone; §9 accepts `agents.planner (default: megamaid:planner)`.

- [ ] **Step 9: Commit**

```bash
git add scripts/check-contract.sh skills/plan/SKILL.md skills/fix/SKILL.md skills/review/SKILL.md skills/help/SKILL.md shared/dispatch-delivery.md
git commit -m "feat(skills): plan and fix resolve the planner role"
```

---

### Task 3: script fixtures for the planner role

**Files:**
- Modify: `scripts/test-megamaid.sh:34-36,60-63,96`
- Modify: `scripts/fixtures/megamaid/noplugin/.claude/megamaid.config.json`
- Create: `scripts/fixtures/megamaid/expected/resolve-planner.out`
- Create: `scripts/fixtures/megamaid/expected/brief-foreign-plan-planner.out`
- Create: `scripts/fixtures/megamaid/expected/brief-plan-1-abcd.plan.planner.md`
- Rename: `scripts/fixtures/megamaid/expected/brief-fix-1-cccc.plan.implementer.md` → `brief-fix-1-cccc.plan.planner.md`
- Modify: `scripts/fixtures/megamaid/expected/brief-plan-same-run.out`

**Interfaces:**
- Consumes: the fixture plugin role from Task 1.

- [ ] **Step 1: Add the cases to `scripts/test-megamaid.sh`**

After line 34 (`run resolve-trivial …`) insert:

```bash
run resolve-planner      resolve --role planner --lane plan "${C[@]}"
```

Replace lines 60–61 with:

```bash
# a fix run's X-item planner brief lands beside its implementer brief: the skill and the role are both in the name
run brief-plan-same-run  brief --skill plan --role planner --run fix-1-cccc "${C[@]}"
```

After line 63 (`run brief-foreign-fix-impl …`) insert:

```bash
# a project overrides the planner with a foreign agent and no when_to_use: the lens is the shipped planner text
run brief-foreign-plan-planner brief --skill plan --role planner --run plan-1-abcd --plugin-root "$P" --home "$H" --project-root "$F/noplugin"
```

Line 96: in the `for b in …` list, replace `fix-1-cccc.plan.implementer` with `fix-1-cccc.plan.planner` and append `plan-1-abcd.plan.planner` before `review-1-ffff.review.code-reviewer`.

- [ ] **Step 2: Add the override to the `noplugin` fixture config**

`scripts/fixtures/megamaid/noplugin/.claude/megamaid.config.json` becomes:

```json
{ "directives": { "include_plugin_defaults": false },
  "agents": { "implementer": { "subagent_type": "general-purpose", "when_to_use": "Writer-capable agent; foreign per the delivery contract." },
              "planner": { "subagent_type": "general-purpose" } } }
```

- [ ] **Step 3: See it fail**

Run: `bash scripts/test-megamaid.sh 2>&1 | grep -E 'MISSING|^---|^\+\+\+|FAIL' | head`
Expected: missing expected files for `resolve-planner`, `brief-foreign-plan-planner`, `brief-plan-1-abcd.plan.planner`, `brief-fix-1-cccc.plan.planner`, and a diff on `brief-plan-same-run.out`; `test-megamaid: FAIL`.

- [ ] **Step 4: Regenerate and review every diff**

```bash
git rm -q scripts/fixtures/megamaid/expected/brief-fix-1-cccc.plan.implementer.md
bash scripts/test-megamaid.sh --update
git status --short scripts/fixtures/
```

Expected new or changed files, and what each must contain:
- `expected/resolve-planner.out`: the two `warning: agents.… dropped` lines, then `subagent_type: megamaid:planner`, `model: sonnet`, `effort: unset`, `native: yes`, `exit=0`.
- `expected/brief-plan-same-run.out`: `brief: TMP/.megamaid/excerpts/fix-1-cccc.plan.planner.brief.md`, `form: native`, the rest unchanged.
- `expected/brief-fix-1-cccc.plan.planner.md`: first line `# megamaid brief — plan / planner (megamaid:planner)`; the rest equals the deleted implementer file.
- `expected/brief-foreign-plan-planner.out`: `brief: TMP/.megamaid/excerpts/plan-1-abcd.plan.planner.brief.md`, `form: foreign`, `directives: 0 plugin, 1 user; primary: none`, `baseline: none`, `exit=0`.
- `expected/brief-plan-1-abcd.plan.planner.md`: first line `# megamaid brief — plan / planner (general-purpose)`; under `## Directives` the authority sentence (`These directives are authoritative. …`), then `Your lens: Planner for /megamaid:plan, and for the issues /megamaid:fix discovers. …` (the full shipped `when_to_use`), then the plain directives intro `The project's authoritative directives apply. …` (not the implementer intro), then the one user directive path.
- `expected/brief-clean.out`: unchanged (`3 file(s)` removed, `0` left).
If anything else changed, stop and find out why before committing.

- [ ] **Step 5: Free gates**

Run: `bash scripts/test-megamaid.sh && claude plugin validate . && bash scripts/check-contract.sh`
Expected: `test-megamaid: OK (… expectations)` with a count higher than before, `check-contract: OK`.

- [ ] **Step 6: Commit**

```bash
git add scripts/test-megamaid.sh scripts/fixtures/megamaid/
git commit -m "test(scripts): planner role fixtures: native resolve, foreign plan brief, X-item brief beside the implementer's"
```

---

### Task 4: hooks test fixtures and the dispatch-delivery eval

**Files:**
- Modify: `hooks/agents.test.ts:29,32,62`
- Modify: `evals/dispatch-delivery/scaffold.sh:2-5,13-14`
- Modify: `evals/dispatch-delivery/graders/brief-delivered.md:4`
- Modify: `evals/README.md:79`

**Interfaces:**
- Consumes: nothing new; `parseBrief` is role-agnostic.

- [ ] **Step 1: Edit `hooks/agents.test.ts`**

Line 29: `await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer', prompt: say(briefPath(FIX_STEM, 'plan', 'implementer')) }))` becomes `await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: say(briefPath(FIX_STEM, 'plan', 'planner')) }))`.

Line 32: `expect(agents.a4).toMatchObject({ role: 'implementer', runStem: FIX_STEM })` becomes `expect(agents.a4).toMatchObject({ role: 'planner', runStem: FIX_STEM })`.

Line 62: `briefPath(STEM, 'plan', 'implementer')` becomes `briefPath(STEM, 'plan', 'planner')`.

Run: `bash scripts/check-contract.sh 2>&1 | tail -n 2`
Expected: `check-contract: OK`; the plugin test run still reports 29 tests, 0 fail.

- [ ] **Step 2: Edit `evals/dispatch-delivery/scaffold.sh`**

Lines 2–5 become:

```bash
# Scratch repo with a finished code-shaped review report. The project config
# overrides the planner with general-purpose (foreign per the delivery contract);
# the shipped default is the native megamaid:planner, which gets no authority
# sentence, and this is the one case that exercises the foreign framing.
```

Lines 13–14 (the heredoc body under `cat > .claude/megamaid.config.json <<'EOF'`) become:

```
{ "agents": { "planner": { "subagent_type": "general-purpose",
  "when_to_use": "Planner-capable agent; foreign per the delivery contract." } } }
```

- [ ] **Step 3: Edit the grader and the README row**

`evals/dispatch-delivery/graders/brief-delivered.md` line 4:

```
input_match: '\.megamaid/excerpts/plan-[0-9]+-[0-9a-f]{4}\.plan\.planner\.brief\.md'
```

`evals/README.md` line 79: `the scaffold overrides the writer with `general-purpose`` becomes `the scaffold overrides the planner with `general-purpose``.

- [ ] **Step 4: Check the grader against a real brief path, offline**

```bash
S=/private/tmp/claude-501/-Users-olafur-Development-megamaid-claude-plugin/32b38009-422a-4b26-80c6-0bf47d3326ee/scratchpad/dd && rm -rf "$S" && mkdir -p "$S" && cp evals/dispatch-delivery/scaffold.sh "$S/" && (cd "$S" && PATH=/opt/homebrew/bin:$PATH bash scaffold.sh && python3 -I "$OLDPWD/scripts/megamaid.py" brief --skill plan --role planner --plugin-root "$OLDPWD" --home "$S/nohome" --project-root "$S" | tee brief.txt) && python3 -I - "$S/brief.txt" <<'EOF'
import re, sys
t = open(sys.argv[1]).read()
path = re.search(r'^brief: (.*)$', t, re.M).group(1)
ok = re.search(r'\.megamaid/excerpts/plan-[0-9]+-[0-9a-f]{4}\.plan\.planner\.brief\.md', path) is not None
print("form foreign:", "form: foreign" in t, "| grader matches:", ok)
EOF
```

Expected: `form foreign: True | grader matches: True`. (`--home "$S/nohome"` is a non-existent dir so no global config leaks in.)

- [ ] **Step 5: Commit**

```bash
git add hooks/agents.test.ts evals/dispatch-delivery/scaffold.sh evals/dispatch-delivery/graders/brief-delivered.md evals/README.md
git commit -m "test(hooks,evals): plan-lane fixtures and the dispatch-delivery scaffold use the planner role"
```

---

### Task 4b: eval case `plan-native-planner`

**Files:**
- Create: `evals/plan-native-planner/case.yaml`
- Create: `evals/plan-native-planner/prompt.md`
- Create: `evals/plan-native-planner/scaffold.sh`
- Create: `evals/plan-native-planner/graders/{brief-delivered,native-form,model-passed,m1-file-written,m2-file-written,no-edit,all-two,no-missing,no-unexpected,next-names-fix,module-loaded}.md`
- Modify: `evals/README.md:79` (table gains a row after `dispatch-delivery`)

**Interfaces:**
- Consumes: the shipped `agents/planner.md` and `agents.planner` default from Task 1.

- [ ] **Step 1: `case.yaml` and `prompt.md`**

`evals/plan-native-planner/case.yaml`:

```yaml
schema_version: "1.1"
name: plan-native-planner
context:
  scaffold_script: scaffold.sh
```

`evals/plan-native-planner/prompt.md`:

```markdown
---
name: plan-native-planner
tags: [plan, planner, native-agent]
runs: 1
max_turns: 60
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/megamaid:plan reviews/pr-1-round1-report.md — plan every finding, no grouping questions.
```

- [ ] **Step 2: `scaffold.sh`**

```bash
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
```

- [ ] **Step 3: Graders**

`graders/brief-delivered.md`:
```markdown
---
type: tool_used
tool: Agent
input_match: '\.megamaid/excerpts/plan-[0-9]+-[0-9a-f]{4}\.plan\.planner\.brief\.md'
min: 2
---
```

`graders/native-form.md`:
```markdown
---
type: regex
pattern: "form: native"
target: trace
match: contains
---
```

`graders/model-passed.md`:
```markdown
---
type: tool_used
tool: Agent
input_match: '"model"\s*:\s*"[a-z]'
min: 2
---
```

`graders/m1-file-written.md`:
```markdown
---
type: file_exists
path: "docs/megamaid/plans/plan-for-pr-1-round1-report/M1-*.md"
---
```

`graders/m2-file-written.md`:
```markdown
---
type: file_exists
path: "docs/megamaid/plans/plan-for-pr-1-round1-report/M2-*.md"
---
```

`graders/no-edit.md`:
```markdown
---
type: tool_used
tool: Edit
min: 0
max: 0
---
```

`graders/all-two.md`:
```markdown
---
type: regex
pattern: "All 2 instruction files ready"
target: last_message
match: contains
---
```

`graders/no-missing.md`:
```markdown
---
type: regex
pattern: "Missing:"
target: last_message
match: not_contains
---
```

`graders/no-unexpected.md`:
```markdown
---
type: regex
pattern: "Unexpected:"
target: last_message
match: not_contains
---
```

`graders/next-names-fix.md`:
```markdown
---
type: regex
pattern: "Next: `?/megamaid:fix "
target: last_message
match: contains
---
```

`graders/module-loaded.md`:
```markdown
---
type: regex
pattern: "MEGAMAID-MODULE-NOT-LOADED"
target: last_message
match: not_contains
---
```

- [ ] **Step 4: Check the report parses as two findings, offline**

```bash
S=/private/tmp/claude-501/-Users-olafur-Development-megamaid-claude-plugin/32b38009-422a-4b26-80c6-0bf47d3326ee/scratchpad/pnp && rm -rf "$S" && mkdir -p "$S" && cp evals/plan-native-planner/scaffold.sh "$S/" && (cd "$S" && PATH=/opt/homebrew/bin:$PATH bash scaffold.sh && python3 -I "$OLDPWD/scripts/megamaid.py" findings --report reviews/pr-1-round1-report.md)
```

Expected: the `findings` output lists `M1` and `M2`, both Medium, count 2, no parse warning. Then `claude plugin validate .` passes (it validates eval cases too).

- [ ] **Step 5: README row**

After the `dispatch-delivery` row in the `evals/README.md` table add:

```
| `plan-native-planner` | The shipped planner regressing: `/megamaid:plan` on a two-finding report with no override must dispatch `megamaid:planner` twice with the native brief (`form: native`), write both instruction files, make no Edit call, and report `All 2` with nothing missing or unexpected. This is the only case that runs `agents/planner.md`; `dispatch-delivery` overrides it |
```

- [ ] **Step 6: Commit**

```bash
git add evals/plan-native-planner evals/README.md
git commit -m "test(evals): plan-native-planner runs the shipped planner on a two-finding report"
```

---

### Task 5: README and roadmap

**Files:**
- Modify: `README.md:61,66-75,95-101,157-159`
- Modify: `docs/handover/plan.md:41` (local only, git-ignored)

- [ ] **Step 1: README, configure sample and models example**

Line 61: `"use sonnet for plan"` becomes `"use sonnet for the fix implementer"`.

Lines 68–70, the example JSON, become:

```json
{
  "models": { "fix": { "implementer_standard": "sonnet" } },
  "effort": { "review": "medium" },
  "agents": { "simplifier": { "model": "haiku" } }
}
```

After the `- **Models** can be …` bullet (the first bullet under the example) add a bullet:

```
- **Where to save:** the planner is the senior of the pair. A good instruction lets a cheaper implementer apply it, so lower `models.fix.implementer_standard` or `models.fix.implementer_trivial` and keep `models.plan` strong.
```

- [ ] **Step 2: README, writer and planner overrides**

Lines 95–101 become:

```markdown
### Use your own writer or planner

```json
{ "agents": { "implementer": { "subagent_type": "your-org:implementer" },
              "planner": { "subagent_type": "your-org:planner" } } }
```

The default writer, `megamaid:implementer`, edits only the files the instruction names, never commits, and reports every file it touched. A writer from outside this plugin gets an explicit instruction that the directives are authoritative. It also gets the same boundaries, and the same file and git checks after it returns.

The default planner, `megamaid:planner`, writes one instruction file per finding and never edits source. A planner from outside this plugin gets the same authority instruction and its lens; a code-shaped plan run counts the output folder after it returns, and that is the only check (a plan run has no git checks).
```

- [ ] **Step 3: README, agent list**

Lines 157–159 become:

```markdown
Four more agents:

- **`megamaid:planner`** is the planner for `/megamaid:plan` and for the issues `/megamaid:fix` discovers.
- **`megamaid:implementer`** is the writer for `/megamaid:fix`.
```

(the two `pattern-*` bullets stay.)

- [ ] **Step 4: Roadmap note (local)**

`docs/handover/plan.md` line 41: `The implementer file boundary, …` becomes `The implementer file boundary (the instruction's `## Where`) and the planner's (one file, the output file its prompt names), …`.

- [ ] **Step 5: Free gates and the old-name guard**

Run: `claude plugin validate . && bash scripts/check-contract.sh && git grep -n -w implementer -- README.md`
Expected: `check-contract: OK`; the README hits are lines 15, 97–98 (the example), 100, 159 only.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(readme): planner override, and where to save on models"
```

---

## After the tasks

Per PLAYBOOK "The loop", steps 5–7. Each paid step: say the cost first. The account held about 14 USD at planning time less the spec review; the paid steps below sum to roughly 8.5 USD.

1. **Branch review.** Two independent reviewers on Opus 5.5, contract lens and code-and-tests lens, briefed with the spec, this plan and the branch diff, not conclusions. Fix Critical and Important findings, each proven by a check that failed first; fix Minor or record it as deferred. Record in the ledger.
2. **Gate.** `claude plugin validate .`, `scripts/check-contract.sh`, `scripts/smoke.sh` (about 0.25 USD), then the full eval suite once (about 5.6 USD, nine cases): `PATH=/opt/homebrew/bin:$PATH claude plugin eval . --scaffold --ablation none --runs 1 --max-cost-usd 12 --allow-tools Bash Write Edit --no-publish --keep-temp --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --json <scratchpad>/results.json`. Compare the eight existing cases per case with the 0.2.0 run (`evals/results/2026-10-14T14-41-00-188Z`, 8/8, 4.56 USD). `dispatch-delivery`'s `brief-delivered` must match the planner brief path. A case that passed there and fails here is read from its kept trace first.
3. **Native planner coverage.** The new `plan-native-planner` case in step 2 replaces the hand-run code-shaped live check: read its graders in the results (`brief-delivered` 2, `native-form`, both files, `no-edit`, `all-two`). The suite is now nine cases, about 5.6 USD; update the "Measured" line in `evals/README.md` with the run's figures in the release commit.
4. **Live, non-code (about 0.3 USD; spec review D2).** In a scratch repo with a non-code review report (shape: `## Read`, `## Lens`, `## Findings` with flat labelled entries; model it on `scripts/fixtures/megamaid/project/reports/noncode-report.md`), run `claude -p "/megamaid:plan reviews/<report>.md" --plugin-dir <this repo> --debug-file <f>` with the same tools. Pass when exactly one `revise-<spec-stem>.md` exists under the plan output folder, in the revise-doc shape of plan Step 6 (its header block and `## Notes for the implementer`), and `<f>` has `plan/planner spawned as megamaid:planner (…)` once.
5. **Release.** CHANGELOG `## [0.3.0] — <date>`: Added, the planner role (`agents/planner.md`, `agents.planner`), dispatched by `/megamaid:plan` and by `/megamaid:fix` for discovered issues; Changed, the implementer is the fix writer only, an `agents.implementer` override no longer applies to planning (no migration: the plugin has no users yet), and the README's model guidance (keep the planner strong, save on the implementer). Then `version` 0.3.0 in `.claude-plugin/plugin.json` and the README Status line (`v0.3.0.`), together; commit `docs(release): v0.3.0 — planner role`. Push on the maintainer's go; open the PR against `main` with the summary and verification record, signed "On behalf of @olioskar by Claude".
6. **CI on the finished branch.** `gh pr checks --watch`: the `contract` job passes. The job log prints `check-contract: OK` and no test count. Merge on the maintainer's instruction, with a merge commit.

## Deviations from the spec (recorded here, and in the ledger when executed)

- The planner's "How to work" names the four `plan-brief.md` steps in a half-sentence each (read, reproduce, read nearby, write) rather than purely by reference, so the file reads on its own; `plan-brief.md` stays the source.
- Help's `models.plan` line gains a second line of guidance; the spec said "a line under models.plan". §9 reads only the `(default: …)` token, so the wrap is safe.
- Task 4 checks the grader regex offline against a real `megamaid.py brief` path; the spec lists that only as a done-when through the eval run.
