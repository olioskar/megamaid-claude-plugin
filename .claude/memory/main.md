# Main memory

Short and current: what this session learned that the docs do not carry. Rewrite, do not append. Under 40 lines.

- The maintainer's standing words: "do not get into hyper marketing fluff mode. Do not overcomplicate, do not 'invent' something you think I asked for"; approved plan + "go" authorizes the plan's per-task commits, confirmed once; "if the eval run it self has issues... dont waste tokens fixing it"; on the MM-028 cost share (2026-10-28): "cost is not the only thing here... we need to make sure megamaid does a perfect job".
- A model named in a dispatch must win over config (2026-10-28, on MM-025): "From my experience with writing and using the mother of megamaid, […], that is a useful and often used thing to have". Hooks fill a model only when none was given.
- Prompt fixes for language bias abstract the concept; they never add a per-language catalogue (the diff shrinks).
- Paid runs: the maintainer has API credits (about 380 USD on 2026-10-29) and runs evals from their own terminal with `ANTHROPIC_API_KEY=$(cat ~/keys/.anthropic-key)` prefixed; the key never passes through a session. Smoke (0.25 USD) may run on the session login. `claude plugin eval` keeps one `--case` per command; the maintainer runs `!`-prefixed eval commands from this session too.
- An interactive `claude --plugin-dir .` can be driven from a session under `expect` (spawn, wait, send `/exit`) to lay the engine types; `claude -p` does not lay them.
- Live runs happen in the maintainer's other sessions (2026-10-28: "overseer" ran the baseline in ~/Development/hardware/parts-bin). Ask that session by SendMessage for the ledger and debug lines, then check them against the files on disk; they are local and readable.
- State at the last save (2026-10-30): 0.5.0 released; MM-028 step 1 built on `feat/fix-mechanics` (unpushed), reviewed and fixed; waits on the group-commit call and the paid runs.
- A docstring change in `scripts/megamaid.py` shifts every `megamaid.py:<line>` citation in docs/api/{scripts,config,working-paths}.md; re-map them by matching the old file's lines against the new one (git show HEAD:…).
- On MM-028 (2026-10-29): "we need the orchestrator to be flexible still"; verdicts can be overridden, overrides listed in the summary. Order agreed: MM-025 first, then MM-028.
- A scratch probe plugin under the session scratchpad (`claude -p --plugin-dir <probe> --model haiku --max-budget-usd 0.10`) tests engine facts for under a cent; validate on it is free.
- Waits: the handover's Now section.
