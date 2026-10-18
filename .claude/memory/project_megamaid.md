---
name: megamaid-project
description: megamaid is the mods-based successor to the comb plugin; separate repo and marketplace entry; state lives in docs/handover/
metadata:
  type: project
---

megamaid (decided 2026-10-12) is a fork of comb 0.15.3 (commit ddd4495, history kept) that moves comb's prose-enforced rules and orchestration mechanics into a Claude Code hooks module (mods). It is released as its own plugin in the olioskar/claude-plugins marketplace and requires a mod-capable Claude Code; comb stays for older builds.

**Why:** call-time guarantees instead of after-the-fact checks, and fewer orchestrator tokens (rough estimate 10–15% hooks-only, 20–30% with code-driven fix orchestration; to be measured in Phase 2).

**How to apply:** At session start read the repo-root `PLAYBOOK.md` and `docs/handover/` (plan.md, megamaid-dev.md, tail of ledger.md); those are the source of truth for process and state. The comb repo is ~/Development/comb-the-desert-claude-skill. Related: [[eval-cadence]], [[plan-execution-commit-authorization]].
