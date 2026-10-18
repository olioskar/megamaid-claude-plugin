# megamaid

A Claude Code plugin for code review: review, plan and fix in one loop, with a hooks module that enforces the rules at call time.

- Start with your role file, `docs/handover/main.md`; it orders the rest (`docs/INDEX.md`, then `docs/process/dev-flow.md`, whose "Rules for every session" bind every session).
- Memory home: `.claude/memory/main.md` (`MEMORY.md` beside it is the engine's one-line index); nowhere else.
- Checks: `claude plugin validate .` and `scripts/check-contract.sh` (tsc and the module tests included). Nothing to build.
- A paid run (eval suite, smoke, live check) needs the maintainer's word for that run, with its cost said first.
- The bar: internal tool until the first public release. Build for failures seen or on the maintainer's ask.
- The backlog is `issues.yaml`. The session commits, by path; a push is the maintainer's call (the rules are in dev-flow).
