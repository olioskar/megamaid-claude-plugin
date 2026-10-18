# Phase 0 spec review, round 2 — 2026-10-12

Spec revision 2. Same two lenses (ambiguity/accuracy; completeness vs decisions), fresh subagents.

Critical: guard still unpassable (README migration line, configure/patterns prose, migration test outputs in non-exempt fixtures/megamaid/expected); exempting all of check-contract.sh hides stale gate needles.
Important: guard not fail-closed; handover PLAYBOOK not deleted; eval skip vs ledger:15 conditional; manifest offer duplicated across two skills; dead comb version citations; config filename only renamed in megamaid.py (5 scaffolds, shared, configure, fix-auto, help, README); notice error handling and path resolution undefined; migrate manifest error cases; migrate config rule precedence (defaults.json has no `effort`); vacu-suck "opening line" would delete rule sentence; configure write-format conflict.
Minor: regeneration rule only in task 5; unassigned stragglers (temp prefixes, "comb eval", comb:*, help :17/:231); /comb:patterns hint in two tasks; smoke.sh wording; 0.15.2 description; megamaid-dev content; memory notes; CHANGELOG [Unreleased] and timing; --shave path; config-loading sentence vs configure/patterns; missing migrate needle; green check via FAIL-grep; missing fixtures; stale manifest notice after config migrate; migrate.py load failure; plan.md hooks naming sentence.

Maintainer decisions: eval skip confirmed (fixtures cover new behaviour); manifest offer in configure + patterns via shared block; smoke.sh run once before PR, wording fixed, not in release gate.
All findings addressed in spec revision 3.
