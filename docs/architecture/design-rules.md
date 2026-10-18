# Design rules

Each rule names where the code holds it.

| Rule | How the code holds it |
|---|---|
| **Single source.** A block shared across skills lives in `shared/` and is read by path. A rule enforced by a hook lives in the hook, and the prose it replaced is removed. | check-contract §2 resolves every reference; §3 fails when a block's needle reappears in a skill. |
| **The stop line is the one copied text.** It must be in the file the engine loads, so every skill but help carries it. | `hooks/stop-line.ts` is the source; §11 keeps each copy equal, once, first after the frontmatter, and `STOP_SKILLS` equal to the skill list. |
| **Every tier that produces an artifact a later tier trusts also verifies it.** | Review opens every cited line and writes a `Verified:` line per finding; plan re-derives what that line leaves unchecked and counts its output folder; fix's reviewer runs the plan's `Check:` line and the orchestrator checks HEAD and the reported file list before a commit. |
| **A gate states its bound**, or it turns into a second review. | Each check-contract section tests one named property; smoke proves two facts (the module loads; the stop line stops) and defers behaviour to the eval suite. |
| **Correctness properties get no config knobs.** | The ledger has no key; no model order is enforced between planner and implementer; `config/defaults.json` holds paths, directives, roles, models and two fix switches; `effort.*` is absent by default. |
| **Guards fail closed.** | The one guard, `skill.prompt`, strips after `next`; run start sits in `try`; the `.catch` replays `next` and strips again. One registration, so no second hook of this plugin can throw the strip away. No hook returns `deny`. |
| **Observers refuse nothing.** | The hooks at refusing sites (`tool.call` Read and Write, `agent.spawn`) take a pass-through `.catch(($, e, next) => next(e))`; `usage.ts` logs `usage hook failed: …` first. Validate still lists them as gating hooks with `.catch`. A fault costs a note or a ledger, never a run. (`session.end` has the same `.catch` for the shared time budget; its site refuses nothing.) |
| **Moving text moves its checks.** When a passage moves (prose to brief to script to hook), every grader, gate needle and pointer that matched it moves with it. | §3 derives needles from the live blocks; §5 holds the wording pairs (`REPORT_NAME` and `report-name`, the migration notices, the `git diff HEAD --` instruction); §11 holds the module-loaded grader. |
| **Trust the model.** Prompts state concepts, not per-language catalogues; a bias fix shrinks the diff. | Agent bodies and shared blocks name failure classes, not idioms; a passage is removed only after a two-arm run in `experiments/` shows its failure does not recur. |
| **Domain-neutral examples. No dead citations. Descriptions carry triggers.** | §1 rejects `spec §` citations in shipped files; every skill's frontmatter description opens with the phrases that invoke it. |
| **No prose fallbacks for builds without hooks modules.** A guard that does not load would be a silent gate. | `hooks/hooks.json` holds only `modules`; the stop line is the only text a module-less build reads. |
| **Every state write goes through `update($, RUN, fn)`.** Review's reviewers spawn in one message and their hooks run at once. | `skill-prompt.ts`, `agents.ts`, `usage.ts`, `session.ts` call `update` (`ifVersion` plus retry); no bare `$.state.set`. |
| **One `RUN` const per writing file.** Validate reads a state ref only as a literal const of that file. | `run.ts` and `ledger.ts` hold no ref; §12 keeps the four copies identical and the file list exact. |
| **LF everywhere.** | `.gitattributes` forces `eol=lf` on `*.md` and `*.ts`; `stripStopLine` also drops a trailing `\r`. |

Process rules (approach first, review before merge, when to pay for a run): [dev-flow.md](../process/dev-flow.md).
