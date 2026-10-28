# Main memory

Short and current: what this session learned that the docs do not carry. Rewrite, do not append. Under 40 lines.

- The maintainer's standing words: "do not get into hyper marketing fluff mode. Do not overcomplicate, do not 'invent' something you think I asked for"; approved plan + "go" authorizes the plan's per-task commits, confirmed once; "if the eval run it self has issues... dont waste tokens fixing it".
- Prompt fixes for language bias abstract the concept; they never add a per-language catalogue (the diff shrinks).
- Paid runs: the maintainer has API credits (about 200 USD on 2026-10-18) and runs evals from their own terminal with `ANTHROPIC_API_KEY=$(cat ~/keys/.anthropic-key)` prefixed; the key never passes through a session. Smoke (0.25 USD) may run on the session login.
- An interactive `claude --plugin-dir .` can be driven from a session under `expect` (spawn, wait, send `/exit`) to lay the engine types; `claude -p` does not lay them.
- Live runs happen in the maintainer's other sessions (2026-10-28: "overseer" ran the baseline in ~/Development/hardware/parts-bin). Ask that session by SendMessage for the ledger and debug lines, then check them against the files on disk; they are local and readable.
- State at the last save (2026-10-28): the baseline is recorded (costs.md); local `main` is ahead of `origin/main` by that commit; next is the maintainer's pick of MM-025 or MM-028.
- Waits: the handover's Now section.
