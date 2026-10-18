# Phase 1b: planner role — design

Date: 2026-10-14. Phase 1b of `docs/handover/plan.md`. Revision 2 (amended after approval: eval case `plan-native-planner`), after one two-lens review (`docs/megamaid/reviews/2026-10-14-phase1b-spec-review.md`; the code lens built rev 1 in a scratch copy and every free gate passed). Decided in the dev session on 2026-10-14 after a brainstorm (ledger): option A, a split, not new planning behaviour.

## Goal

`/megamaid:plan` dispatches its planners as their own role, `planner`, instead of borrowing the fix writer role `implementer`. Each role then has one job, one agent file with boundaries written for that job, one config entry, and one override. Nothing a user sees in a plan run changes: the same dispatches, the same prompts, the same `shared/plan-brief.md`, the same instruction files and revise-docs.

## Why

- The implementer's agent file is fix-shaped. Its boundaries ("write only inside the instruction's `## Where`", "run a command only when `## How` names it") describe applying an instruction, not writing one. A planner reads past rules that do not apply to it.
- One `agents.implementer` override covers both lanes. A project cannot plug in a planner without replacing its fix writer, and a per-role `agents.implementer.model` hits both.
- Phase 3 enforces file boundaries per role. The implementer's is "the instruction's `## Where`"; the planner's is "exactly one file, the output file its prompt names". Two roles with two rules is simpler than one role whose rule depends on lane.
- The planner is where the quality of a fix is decided (maintainer, 2026-10-14): the better the instruction, the cheaper the implementer that can apply it. A role of its own makes that the documented trade: keep the planner strong, save on the implementer.

Rejected in the brainstorm: one planner for the whole report (Phase 6 territory: changes parallelism, the specialty lens, the file-count checks); a planner that can decline a confirmed finding (reopens a decision the user made when accepting the report; `Finding status: not reproduced` already covers the defensible case).

## Bound

- Behaviour of a plan run is unchanged. The planner has three dispatch sites, and each keeps its prompt: the code-shaped per-finding dispatch (plan Step 6) and fix's DISCOVERED path read `shared/plan-brief.md` then the run brief and write one instruction file; the non-code dispatch (plan Step 6, non-code flow) carries its own job and output format, reads the run brief only, and writes one revise-doc. The planner agent file defers to the dispatch prompt and so fits all three.
- No hooks change. Run detection takes role and lane from the brief path, so a planner spawn is recorded as `plan/planner` with no code change; two tests' fixture names move. This supersedes the Phase 1 spec's note (its "Lane" line) that plan briefs use role `implementer`; keying on (lane, role) is unchanged.
- One new eval case, `plan-native-planner` (maintainer, 2026-10-14, on a side note: the shipped planner is otherwise the one writer role with no standing coverage). It runs `/megamaid:plan` on a two-finding code-shaped report with no override, so the native `agents/planner.md` is exercised on every suite run (about 1 USD). The `dispatch-delivery` scaffold moves its writer override from `agents.implementer` to `agents.planner`. The suite runs once, as the cadence says; the eight existing cases are compared with the 0.2.0 run (8/8, 4.56 USD).
- What catches a planner that writes the wrong file: Step 7's count in a code-shaped plan run ("Count before presenting") catches a missing file and an unexpected file inside the output folder. A write elsewhere, or by a DISCOVERED or non-code planner, is unchecked until Phase 3.
- Config: an `agents.implementer` override no longer applies to planning. No migration: nobody uses the plugin yet (maintainer, 2026-10-14). The CHANGELOG says so.

## Decisions

| Question | Decision |
|---|---|
| Role and agent name | `planner`, `megamaid:planner`, `agents/planner.md`. Matches the word the plan skill, the help text, `megamaid.py` (`ROLE_NOTES["planner"]`) and `shared/plan-brief.md` already use. |
| Planner tools | `disallowedTools: Agent, Edit, NotebookEdit`. Write stays: the planner's output is one new file. Bash stays: `git log`, `git blame` and `grep` are reading tools the planner uses to trace a finding. Source edits are out, so Edit goes. check-contract asserts the line (Gates). |
| Seniority | The planner is the senior of the planner/implementer pair (maintainer, 2026-10-14): it reads the code, traces the failure and writes small exact steps that an implementer follows without judgment calls. The agent file opens with that framing. The model rule is guidance, not enforcement (review D1): `models.plan` defaults to `opus`, equal to `models.fix.implementer_standard`; there is no trivial planner lane; README and help say that the planner model is the one to keep strong and the implementer model is the one to lower for savings, and the README example and the configure sample stop lowering `plan`. No rank order over model ids: fragile, and PLAYBOOK gives correctness properties no knobs, which this is not. |
| Planner boundaries (agent file) | Writes exactly one file, the output file its shared context names; never edits a source file; never commits, stages, stashes, resets or checks out; never dispatches agents or invokes skills; its reply names the file it wrote. |
| Implementer after the split | Fix only. Its agent file loses the plan clause and the "when `/megamaid:plan` dispatches you" output-format override. Its `when_to_use` loses "and `/megamaid:plan`". |
| Lane and model keys | Unchanged: `--lane plan` resolves `models.plan` and `effort.plan`. `agents.planner.model` and `.effort` override per role, as for every role. |
| Override semantics | `agents.planner` is the planner override; a foreign planner gets the authority sentence and `Your lens:` from the delivery contract, as a foreign implementer does; it gets no git checks (a plan run has none), only Step 7's count in a code-shaped run. `agents.implementer` is the fix writer override only. |
| `megamaid.py` | No code change. `role_note_for` already picks the planner note by skill; `render_brief` already picks the implementer directives intro by `(fix, implementer)`; the brief file is `<run>.<skill>.<role>.brief.md`. The `resolve` command checks the role exists in `agents`, so the fixture plugin's `defaults.json` gains the role. |
| Version | 0.3.0: a new role and a changed override, pre-1.0. |

## Changes

### Agent file: `agents/planner.md`

Frontmatter: `name: planner`; description "Planner for /megamaid:plan, and for the issues /megamaid:fix discovers. Reads one review finding and the code it names, reproduces it, and writes one fix instruction file. Never part of a review palette."; `model: opus`; `disallowedTools: Agent, Edit, NotebookEdit`.

Body, in the implementer file's shape (Inputs, Boundaries, How to work, Output), opening with the seniority framing: a senior developer who reads the code, traces the failure, and writes instructions an implementer applies cold, in small exact steps, with nothing left to decide. The body defers to the dispatch prompt, as the implementer's does today ("the dispatch prompt names which"):

- **Inputs.** The dispatch prompt's shared context and the files it names to read first. For a per-finding dispatch (plan Step 6 code-shaped, fix DISCOVERED) that is `shared/plan-brief.md` (the job and the instruction file format) then the run brief. For a revise-doc dispatch (plan Step 6 non-code) the prompt carries its own job and output format and names the run brief only.
- **Boundaries.** As in Decisions, plus the bound: in a code-shaped plan run Step 7's count catches a missing or unexpected file in the output folder; nothing else is checked until Phase 3, so the boundary is the planner's to keep.
- **How to work.** The job the dispatch prompt and its shared brief give: for a per-finding dispatch, the four steps of `plan-brief.md` ("What to do"), by reference, not copied; for a revise-doc, the prompt's own steps.
- **Output.** The file is the artifact, and everything the format asks for goes in it, a structural concern included (`plan-brief.md` says "surface the structural concern in your output", and its output is the file). The reply names the file written and, where the format has one, its `Finding status`. The orchestrator does not read the reply for content. No code in the reply.

### Agent file: `agents/implementer.md`

Remove "or, when `/megamaid:plan` dispatches you, you write one instruction file. The dispatch prompt names which." and the line "When `/megamaid:plan` dispatches you, the planner brief's output format replaces this section." Description becomes "Writer agent for /megamaid:fix. Executes one fix instruction exactly as dispatched. Never part of a review palette." Frontmatter `disallowedTools: Agent, NotebookEdit` is unchanged and becomes asserted (Gates).

### Config: `config/defaults.json`

Add, after `implementer`:

```json
"planner": {
  "subagent_type": "megamaid:planner",
  "when_to_use": "Planner for /megamaid:plan, and for the issues /megamaid:fix discovers. Writes exactly one file per dispatch, the output file its prompt names; never edits source, never commits, never dispatches agents. Override per-project to plug in a specialist planner; the override inherits these boundaries through its run brief's `Your lens:` line. Not part of the review palette."
}
```

`implementer.when_to_use` becomes "Writer for /megamaid:fix. Writes only inside the instruction's ## Where, …" (the rest unchanged).

### Shared

- `shared/dispatch-delivery.md`, the run-brief line: the rationale "(the skill is in the name so a fix run's X-item planner brief never overwrites its implementer brief)" becomes "(the skill and the role are in the name, so one run's briefs never collide)".

### Skills

- `skills/plan/SKILL.md`, Step 6, both flows: `resolve --role planner --lane plan`, `brief --skill plan --role planner …`, "the user's `agents.planner` override is honored", "(skill plan, role planner)". The "Resolve the writer role" bullet becomes "Resolve the planner role (the planner needs Write access; the `megamaid:*` review roles cannot write …)". The specialty-lens bullet adds "never a writer role (`implementer`, `planner`)".
- `skills/fix/SKILL.md`, DISCOVERED: "Resolve the planner with `resolve --role planner --lane plan`", `brief --skill plan --role planner --run <run> …`.
- `skills/review/SKILL.md`, Step 4 palette: "`pattern-scanner`, `pattern-shaver`, `implementer` and `planner` are never eligible … the last two are writer roles, and review is read-only."
- `skills/help/SKILL.md`, exact edits: the plan section's Config knobs gain `agents.planner          (default: megamaid:planner)  the planner agent` and a line under `models.plan`: "keep it strong; a good instruction lets a cheaper implementer apply it"; the fix section's "What it does" gains "A discovered issue is planned by agents.planner on models.plan."; the fix knob line becomes `agents.implementer     (default: megamaid:implementer)  the fix writer agent`. check-contract §9 compares every `(default X)`, with or without the colon, against `defaults.json`.

### Script fixtures (`scripts/fixtures/megamaid/`, `scripts/test-megamaid.sh`)

- `plugin/agents/planner.md` (frontmatter `name: planner`), so `resolve --role planner` is native in the fixture plugin. `plugin/config/defaults.json` is a byte copy of the real file today: copy the new real file over it. `expected/config.out` changes in two entries: `planner` added, implementer `when_to_use`.
- `brief-plan-same-run` changes to `--role planner`: a fix run's X-item planner brief lands beside the implementer brief under the same stem (`fix-1-cccc.plan.planner.brief.md` next to `fix-1-cccc.fix.implementer.brief.md`). The comment says the skill and the role are both in the name. The expected brief file is renamed and its content changes (header `plan / planner (megamaid:planner)`), and `brief-plan-same-run.out`'s `brief:` line changes; the `for b in …` list names `fix-1-cccc.plan.planner`. Regenerate with `--update` and review the diff. `brief-clean.out` stays at 3 files.
- New case `resolve-planner`: `resolve --role planner --lane plan "${C[@]}"`. Expected: the two `warning:` lines the fixture config produces, `subagent_type: megamaid:planner`, `model: sonnet` (the home fixture sets `models.plan: sonnet`), `effort: unset`, `native: yes`, `exit=0`.
- New case `brief-foreign-plan-planner`: the `noplugin` fixture config gains exactly `"planner": { "subagent_type": "general-purpose" }` (no `when_to_use`, so the lens is the shipped planner text: this is the case that exercises "the override inherits these boundaries through Your lens"). Run as `brief --skill plan --role planner --run plan-1-abcd --plugin-root "$P" --home "$H" --project-root "$F/noplugin"`. Add `plan-1-abcd.plan.planner` to the `for b in …` list. Expected `brief-plan-1-abcd.plan.planner.md`: header `plan / planner (general-purpose)`, the authority sentence, `Your lens: <the defaults planner when_to_use>`, then the plain directives intro (not the implementer one). The existing `brief-foreign-plan` (role `ours`) stays.

### Hooks tests (`hooks/agents.test.ts`)

Two tests change, fixture names only. "lanes tell apart one role name in several jobs" keeps its name and purpose (one role, `code-reviewer`, in the review and fix lanes); its plan-lane spawn becomes `megamaid:planner` with `briefPath(FIX_STEM, 'plan', 'planner')`, and its last assertion expects `role: 'planner'`. "a foreign spawn without a brief is ignored (control: with a brief it is recorded)" uses `briefPath(STEM, 'plan', 'planner')`. No source change, so no fail-first check here; the task's fail-first check is `resolve-planner` or the new grep. The gate is that the 29 tests still pass.

### Evals

- New case `evals/plan-native-planner/`: `case.yaml` (schema 1.1, scaffold script), `prompt.md` (same frontmatter as `dispatch-delivery`, tags `[plan, planner, native-agent]`, prompt `/megamaid:plan reviews/pr-1-round1-report.md — plan every finding, no grouping questions.`), `scaffold.sh` (the `dispatch-delivery` repo without the config override, plus `src/config.js` and a second Medium finding `M2` on it in the report), and graders: `brief-delivered` (Agent prompt matches `\.megamaid/excerpts/plan-[0-9]+-[0-9a-f]{4}\.plan\.planner\.brief\.md`, min 2), `native-form` (trace contains `form: native`), `model-passed` (Agent input carries `"model"`, min 2), `m1-file-written` and `m2-file-written` (`file_exists` on `docs/megamaid/plans/plan-for-pr-1-round1-report/M1-*.md` and `M2-*.md`), `no-edit` (`tool_used` Edit, min 0, max 0), `all-two` (last message contains `All 2 instruction files ready`), `no-missing` and `no-unexpected` (last message not_contains `Missing:` / `Unexpected:`), `next-names-fix`, `module-loaded`. The `evals/README.md` table gains the row; the "Measured" line is updated after the suite runs.
- `evals/dispatch-delivery/scaffold.sh`: the config override becomes `{ "agents": { "planner": { "subagent_type": "general-purpose", "when_to_use": "Planner-capable agent; foreign per the delivery contract." } } }`; the header comment names the planner.
- `evals/dispatch-delivery/graders/brief-delivered.md`: `input_match` becomes `\.megamaid/excerpts/plan-[0-9]+-[0-9a-f]{4}\.plan\.planner\.brief\.md`.
- `evals/README.md`, the `dispatch-delivery` row: "overrides the planner with `general-purpose`".

### Gates (`scripts/check-contract.sh`)

- §5, after the `megamaid.py" findings` line, a new check with every pattern passed through `-e` (a pattern starting with `--` is otherwise read as a grep option, exits 2, and reads as "no match" forever): `skills/` contains neither `--role implementer --lane plan` nor `--skill plan --role implementer`; both `skills/plan/SKILL.md` and `skills/fix/SKILL.md` contain `--role planner --lane plan`. Argument order is part of the pattern; that is accepted. Each half is seen to fail on its own: the negative half against the current tree with the positive half commented out, the positive half against a tree where one skill still says `--role implementer`.
- §8 covers the new agent file and role with no change (every `megamaid:*` subagent_type has a file; every file is a default). It gains two exact-line asserts: `agents/planner.md` frontmatter carries `disallowedTools: Agent, Edit, NotebookEdit` and `agents/implementer.md` carries `disallowedTools: Agent, NotebookEdit` (validate accepts any text there, so nothing else checks it). Seen to fail on the current tree (no planner file).
- §9 (help defaults) picks up `agents.planner` once help names it.

### Docs

- `README.md`: "Use your own writer" becomes "Use your own writer or planner" and shows both overrides. It says the implementer is the fix writer and the planner writes one instruction file per finding; that a foreign planner gets the authority sentence and its lens, and in a code-shaped plan run the Step 7 file count, but no git checks (a plan run has none; the "same file and git checks" promise stays with the fix writer). Under "Models and effort" it says: the planner is the senior of the pair; a good instruction lets a cheaper implementer apply it, so lower `models.fix.implementer_standard` or `models.fix.implementer_trivial` for savings and keep `models.plan` strong. The example becomes `"models": { "fix": { "implementer_standard": "sonnet" } }`, and the configure sample request becomes "use sonnet for the fix implementer". "Three more agents" becomes four: `megamaid:planner` "is the planner for `/megamaid:plan` and for the issues `/megamaid:fix` discovers", `megamaid:implementer` "is the writer for `/megamaid:fix`".
- `CHANGELOG.md` `## [0.3.0]`: Added, the planner role and `agents.planner`; Changed, the implementer is the fix writer only, an `agents.implementer` override no longer applies to planning (no migration; the plugin has no users yet), and the README's model guidance (keep the planner strong, save on the implementer).
- `docs/handover/plan.md` Phase 1b: replaced by the decided scope; Phase 3's per-role boundary list names the planner's.

## Done when

- Free gates pass: `claude plugin validate .`, `check-contract.sh` (tsc, plugin tests, the new §5 grep, the §8 asserts, the fixtures), 29 hooks tests.
- `scripts/smoke.sh` passes once.
- The eval suite runs once, pinned like CI, and every case passes; `dispatch-delivery`'s `brief-delivered` matches the planner brief path.
- The new case `plan-native-planner` passes: two planner briefs delivered (`.plan.planner.brief.md` in two Agent prompts), `form: native` in the trace, both instruction files exist, no Edit call in the trace, `All 2` with no `Missing:` or `Unexpected:` in the summary, `Next: /megamaid:fix`, module loaded. This replaces a hand-run code-shaped live check.
- Live, non-code (review D2): a `/megamaid:plan` on a scratch non-code report produces one `revise-<stem>.md` in the revise-doc shape of plan Step 6. About 0.3 USD. This is the one dispatch site no eval reaches.
- Release 0.3.0 per the PLAYBOOK, as its own PR.

## Not in this phase

- Hook enforcement of the planner's one-file boundary (Phase 3).
- A per-lane trivial planner model, like `fix.implementer_trivial`: the planner is the senior of the pair, so there is no trivial planner.
- Enforcing a model order between planner and implementer.
- Any change to what a planner writes.
