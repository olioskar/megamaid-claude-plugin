# Phase 1b spec review — rev 1 (2026-10-14)

Two independent lenses on Opus 5.5: contract (C), code and tests (T). The T lens built the spec in a scratch copy: with the spec applied, `test-megamaid.sh` 111 expectations OK, `tsc` clean, `claude plugin test` 29/29, validate OK, `check-contract: OK`; the eval scaffold's planner brief path matches the new grader regex. So the spec is implementable; the findings are about what it says, not whether it builds.

Spec: `docs/superpowers/specs/2026-10-14-megamaid-planner-role-design.md`.

## Critical

**C1 (C-C1, T-I4). The planner agent body is written for the per-finding flow only, but the non-code flow dispatches the same role with a different prompt.** The non-code planner reads only the run brief, carries its own job and revise-doc format, and has no `Finding status` (`skills/plan/SKILL.md:144-206`). A body that says "read plan-brief.md, follow its four steps, report Finding status" would change the revise-doc, which contradicts "nothing a user sees changes", and no eval covers plan on a non-code report. Fix: the body defers to the dispatch prompt, as the implementer's does today ("the dispatch prompt names which"): Inputs are "the shared context and the files the dispatch prompt names to read first"; How to work and Output are "the job and format the dispatch prompt and its shared brief give; `Finding status` where the format has one". Bound sentence reworded likewise.

## Important

**I1 (C-I1, T-M7). The file-count claim names the wrong step and overstates the check.** "Count before presenting" is Step 7, code-shaped only, lists `{output_folder}/*.md` only; DISCOVERED and non-code planners get no count. Fix: "Step 7's count (code-shaped plan runs) catches a missing file and an unexpected file inside the output folder. A write elsewhere, or by a DISCOVERED or non-code planner, is unchecked until Phase 3."

**I2 (C-I2). The three-line reply would lose the structural concern.** `plan-brief.md` puts the concern in the file; nothing reads planner replies (`skills/plan/SKILL.md:265`). Fix: the concern stays in the file; the reply names the file and its `Finding status`, and the orchestrator does not read it for content.

**I3 (C-I3). "Never below the implementer's model" is unenforced and the README's own example lowers plan.** `README.md:61,69` recommend `models.plan: sonnet`; help lists it as a free knob. Decision D1 below.

**I4 (C-I4, T-M6). The help edit is ambiguous.** The fix section lists no plan knobs. Fix: plan section Config knobs gain `agents.planner          (default: megamaid:planner)  the planner agent`; the fix section's "What it does" gains "A discovered issue is planned by agents.planner on models.plan"; line 227 becomes "the fix writer agent".

**I5 (C-I5, T-I2, T-M3). `brief-foreign-plan-planner` would check nothing as specified.** Brief content is snapshotted only for stems in the `for b in …` list; no stem is named; the `noplugin` override's shape decides whose `when_to_use` the lens shows. Fix: run as `brief --skill plan --role planner --run plan-1-abcd --plugin-root "$P" --home "$H" --project-root "$F/noplugin"`; add `plan-1-abcd.plan.planner` to the list; expected `brief-plan-1-abcd.plan.planner.md` has header `plan / planner (general-purpose)`, the authority sentence, `Your lens: <defaults planner when_to_use>`, the plain directives intro; the `noplugin` override is exactly `"planner": { "subagent_type": "general-purpose" }` (no `when_to_use`), which is also the case that exercises "the override inherits the boundaries through Your lens".

**I6 (T-I1, T-M5). The new grep, written the obvious way, never fires.** Patterns starting with `--` are read as options; exit 2 counts as no match. Fix: `-e` for each pattern, placed in §5 after the `megamaid.py" brief` checks; see each half fail on its own (negative half against the current tree, positive half against a tree where one skill still says implementer); accept that argument order matters.

**I7 (T-I3). Nothing verifies the planner's tool restriction or a native planner run.** Validate accepts any `disallowedTools` text; §8 reads only `name:`; every eval that reaches plan overrides the planner with `general-purpose`; the live check only reads the spawn log line. Fix: §8 asserts `agents/planner.md` carries exactly `disallowedTools: Agent, Edit, NotebookEdit` and `agents/implementer.md` exactly `disallowedTools: Agent, NotebookEdit`; the live run also requires the plan summary's `All {N}` with no `Missing:`/`Unexpected:` and no Edit call by a planner in the debug log.

## Minor

- **M1 (C-M1).** The planner is also dispatched by fix's DISCOVERED path. Wording in the description, `when_to_use` and README: "Planner for /megamaid:plan, and for the issues /megamaid:fix discovers".
- **M2 (C-M2, T-M4).** Leftovers: `shared/dispatch-delivery.md:21` rationale becomes "the skill and role are in the name so one run's briefs never collide"; fix DISCOVERED says "Resolve the planner with"; plan Step 6 lens bullet: "never a writer role (`implementer`, `planner`)"; `brief-plan-same-run` is regenerated with `--update` (content changes, not only the name).
- **M3 (C-M3, T-M2).** `resolve-planner` expected lines: the two `warning:` lines, `subagent_type: megamaid:planner`, `model: sonnet` (the home fixture sets `models.plan: sonnet`), `effort: unset`, `native: yes`, `exit=0`.
- **M4 (C-M4).** Hooks tests: two tests change, name them ("lanes tell apart one role name in several jobs"; "a foreign spawn without a brief is ignored (control: with a brief it is recorded)"); the fail-first check for that task is the new grep or `resolve-planner`.
- **M5 (T-M1).** The fixture `defaults.json` is a byte copy of the real one: copy it over; `config.out` changes in two entries (planner added, implementer `when_to_use`).
- **M6 (C-M6).** README's foreign-writer promise of "the same file and git checks" does not hold for a planner: state the authority sentence, the lens, and the Step 7 count for code-shaped plans only.
- **M7 (C-M7).** Add: "This supersedes the Phase 1 spec's note that plan briefs use role `implementer`; keying on (lane, role) is unchanged."

## Decisions for the maintainer

- **D1 (I3): the seniority rule.** Options: (a) advice: `models.plan` defaults to opus, README and help recommend keeping it at or above the implementer model, and the README example and the configure sample stop lowering `plan` (change them to lower `review` or `fix.implementer_trivial` instead); (b) enforced: `/megamaid:configure` rejects a `models.plan` below `models.fix.implementer_standard` on the opus > sonnet > haiku order, custom ids unranked. Recommendation: (a). A rank order over model ids is fragile, and PLAYBOOK says correctness properties get no knobs; this is guidance, not a correctness property.
- **D2 (C1): verify the non-code flow live.** A `/megamaid:plan` on a small non-code report, about 0.3 USD, added to Done when; or mark it unverified in Bound. Recommendation: run it. Cheap, and it is the one dispatch site with no eval.

Everything else is applied to rev 2 as proposed.
