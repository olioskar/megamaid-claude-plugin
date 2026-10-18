# megamaid docs

| Set | What it holds |
|---|---|
| [process/dev-flow.md](process/dev-flow.md) | How a change happens, step by step, and the rules every session keeps |
| [handover/main.md](handover/main.md) | The one role: what it does, how a session starts, where the project stands |
| [features/](features/INDEX.md) | What each command does, as a user sees it |
| [architecture/](architecture/INDEX.md) | How the plugin is built: the parts, the hooks module, the gates, the design rules |
| [api/](api/INDEX.md) | The interface: config keys, script subcommands, hook events and state, paths written in a project |
| [knowledge/](knowledge/INDEX.md) | Learned the hard way: the engine, the test kit, this machine and CI, costs, live-check recipes |
| [../evals/README.md](../evals/README.md) | The eval suite: cases, graders, how to run and replay it |
| [../experiments/README.md](../experiments/README.md) | Two-arm runs that test whether a prompt passage is still needed |
| `specs/` | The spec of the work under way, if any; folded into the docs and deleted at release |

Also at the root: `README.md` (usage), `CHANGELOG.md` (the history document; git holds the rest), `issues.yaml` (the backlog), `CLAUDE.md` (the entry). Memory: `.claude/memory/main.md`.

Ids defined in deleted material (spec sections, review finding ids, ledger lines) are found with `git log -S'<id>' --all` and read with `git show <commit>:<path>`; the last tree that held them is the commit "chore(docs): snapshot the untracked working docs before the reset".
