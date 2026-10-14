# Playbook

How megamaid is developed and how we work together. It describes the current practice. When a practice changes, rewrite its passage in place; the ledger keeps the history. Cut what a fresh session no longer needs.

## Working together

- **Approach first.** Non-trivial work starts with the approach (a spec or a short proposal), agreed before any code.
- **Approved plan + "go"** authorizes the plan's per-task commits. Confirm the commit policy once at the start of execution, then don't ask again.
- **Push only on the maintainer's go.** The maintainer merges PRs (`gh pr merge` is blocked for Claude).
- **Scope.** Make the change asked for. Flag other opportunities (what, where, why, how) and leave them for the maintainer to choose.
- **Prose.** Plain and grounded. No marketing language, and no fields, knobs or sections nobody asked for.
- **Spend.** Say the cost before a paid run. If a tool or runner outside the plugin fails, report it and stop.

## Where things live

- `skills/*/SKILL.md` and `shared/*.md`: the prose runtime contract. `shared/manifest-migration.md` is the manifest-migration offer used by configure and patterns.
- `hooks/`: the hooks module, the code half of the runtime contract. `register.ts` wires one file per event (`skill-prompt.ts`, `read-note.ts`, `agents.ts`, `session.ts`); pure helpers without `$` live in `run.ts` and `stop-line.ts`, the stop line's single source; tests are `*.test.ts` with `test-rig.ts`. `types/` holds the `$.state` contract. `vendor/claude-code-types/` is the pinned engine API, refreshed by `scripts/sync-types.sh`.
- `agents/*.md`, `directives/`, `config/defaults.json`: agents, shipped policy, config keys and defaults.
- `scripts/`: the helpers the skills call and their fixture tests. Change a script and its fixtures together. `scripts/migrate.py` holds every name of the plugin megamaid was forked from (the old-name guard exempts it).
- `evals/` (the suite) and `experiments/` (two-arm runs).
- `CHANGELOG.md`: the only version history users see.
- `docs/` is gitignored: specs and plans in `docs/superpowers/`, review reports in `docs/megamaid/reviews/`, and `docs/handover/` (plan, ledger, state). This playbook is tracked at the repo root.

## The loop

1. **Design.** A dated spec in `docs/superpowers/specs/`, agreed before planning.
2. **Plan.** A plan in `docs/superpowers/plans/` with one task per commit. Each task's test or check is written first and seen to fail.
3. **Branch.** A feature branch per phase. `main` changes only through PRs.
4. **Execute.** One commit per task. Record each deviation from the plan, with its reason, in the ledger.
5. **Review.** Independent subagents on the strongest available model review the spec and plan before execution, and the branch before release. Brief them with the files, not with conclusions. Give each lens its own reviewer: contract, and code and tests. Never review the plugin with its own commands. Fix Critical and Important findings, each proven by a check that failed first. Fix Minor findings or record them as deferred.
6. **Gate.** Run the release gate and skip nothing.
7. **Release.** Changelog entry, then bump `version` and the README Status line together. Push on go, then open the PR.

Small fixes skip steps 1 and 2, never 3 to 7.

## Release gate

1. `claude plugin validate .`
2. `scripts/check-contract.sh`
3. Covered by step 2: `check-contract.sh` runs `tsc` and `claude plugin test`.
4. `claude plugin eval . --scaffold --ablation none --runs 1 --allow-tools Bash Write Edit --no-publish --trust-plugin`. On macOS put Homebrew git first on the `PATH` and pass `--keep-temp`.

`scripts/smoke.sh` runs once before a PR: the free gates, help with the module on (and proof it loaded), and review with it off, which must stop (about 0.25 USD).

CI runs the free gates on every push and PR. Evals run on manual dispatch.

### Eval cadence

| Situation | Run | Cost |
|---|---|---|
| Every commit | the free gates | free |
| A PR that can change behaviour, before merge | the full suite | about 5 USD |
| A change confined to one area | that case, `--case <name>` | about 1 USD |
| Prose-only edits; debugging outside the plugin | nothing | free |
| A grader that looks wrong | one `--keep-temp` run, then `python3 -I scripts/replay-graders.py evals/<case> <kept dir>` offline | near free |
| Removing a guard passage | a two-arm run in `experiments/` | a few USD |

Never re-run a paid case to test a grader edit.

## Design rules

- **Single source.** A block shared across skills lives in `shared/`. A rule enforced by a hook lives in the hook, and the prose it replaced is removed.
- **The stop line is the one copied text.** It must be in the file the engine loads, so each skill but help carries it; `check-contract.sh` keeps every copy equal to `hooks/stop-line.ts`.
- **Every tier that produces an artifact a later tier trusts also verifies it.**
- **A gate states its bound**, or it turns into a second review.
- **Correctness properties get no config knobs.**
- **Guards fail closed.** Every hook that can refuse something is written with `.catch(($, e, next) => next.called ? next(e) : { deny: '…' })`. A guard that throws without a handler lets the call through.
- **Observers refuse nothing.** A hook that only records, at a site that can refuse (`agent.spawn`, `tool.call`), takes a pass-through `.catch(($, e, next) => next(e))`; validate still lists it as gating.
- **Moving text moves its checks.** When a passage moves (prose → brief → script → hook), update every grader, gate needle and pointer that matched it.
- **Trust the model.** Prompts state concepts, not per-language catalogues.
- **Domain-neutral examples. No dead citations. Descriptions carry triggers.**

## Writing conventions

- **Changelog:** Keep a Changelog and SemVer, newest first. Each entry leads with what changed, then why.
- **Commits:** `type(scope): summary`. Release commits are `docs(release): vX.Y.Z — <theme>`.

## Session continuity

Session state is in `docs/handover/`; the playbook is tracked at the repo root:

- `PLAYBOOK.md` (repo root): this file.
- `docs/handover/plan.md`: the phase roadmap. Edit it when order or scope changes.
- `docs/handover/<line-of-work>.md` (now `megamaid-dev.md`): a snapshot of state, next steps, decisions and open questions. Rewrite it at each milestone and before a session ends.
- `docs/handover/ledger.md`: append-only, one dated line per event.

At session start, read the handover, the tail of the ledger, `plan.md`, and this playbook. If it is unclear which line of work a session belongs to, ask; never guess.
