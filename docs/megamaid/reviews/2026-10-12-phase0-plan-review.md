# Phase 0 plan review — 2026-10-12

Two lenses. Contract (plan vs spec and playbook): 0 Critical, 4 Important, 14 Minor. Scripts and commands (every task executed verbatim in a scratch clone, bash 3.2 / Apple tools): 1 Critical, 1 Important, 9 Minor.

Critical: guard fail-closed self-test always failed under `set -o pipefail` (name_guard's exit 1 dominated the pipeline) — fixed with `{ name_guard … || true; }`.
Important: self-tests did not cover the exemptions, URL skip, path check, `_` form or the-desert (replaced with an exact-output self-test); PLAYBOOK "Where things live" items missing; null-at-dropped-path and empty-object fixtures missing; CHANGELOG contradicted the coexistence decision; several tasks lacked a fail-first check (README, LICENSE, lineage headers, version, CHANGELOG).
Minor (all applied): GUARD=off scope recorded as a deviation; configure layer rule; green covers tasks 2–9; lone migrate case; notice-wording needles; Task 10 outside-git strings; exact help two-line quote; help overview re-alignment; configure description trigger; non-object effort/models rule + fixture; CHANGELOG Removed section; exact test-loop lines; notice-same via symlink (Linux); README install duplicate; header check pattern; mkdir for bom/translate; Step 3 expectation; layouts check after commit; test-replay check; `|| true` on grep -c; sys.dont_write_bytecode; shave insertion point.
Reviewer confirmed (after fixes): every step's expected result, 28 migrate expectations, guard passes with GUARD on at the end.
