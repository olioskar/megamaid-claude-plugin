# Phase 0 branch review — 2026-10-12

Range ddd4495..3c467f1 on feat/v0.1.0-identity. Two lenses on Opus 5.5 (Fable credits exhausted; maintainer chose Opus).

## Fixed (each RED→GREEN)
- Non-UTF-8 comb config crashed `config` (traceback) and `migrate config` (exit 1). Now notice + exit 0, and exit 2 "not UTF-8 text". Fixtures notice-latin1, translate-latin1.
- `migrate manifest --move` on a symlinked manifest moved the shared target. Now copies the content and removes the link. Fixtures manifest-linked(-shared).
- configure Step 2a had no failure path for `migrate config`. Added; needle in check-contract.
- README `git mv docs/combs docs/megamaid` could nest folders or strand kept paths. Rewritten (ruling: prose, verified by reading).

## Minors (all 18 verified and fixed at the maintainer's request; commits d1cf1bb, df99b13, and the skills commit)
1. configure Step 2a picks the layer by path prefix; a symlinked project `.claude` makes the realpath'd notice look like home (migrate then exits 2 "missing"). Fix: label the notice with its layer, or print the logical path.
2. configure Ground rules ("one scope per invocation", "inspect → Step 2 and stop") contradict Step 2a.
3. configure Inputs: for a bare `/megamaid:configure`, say "run Step 2 before asking anything".
4. Declining migration then writing a change at that layer silences the notice for good without saying so.
5. shared/config-loading.md "final report" is ambiguous for review/plan (report = written file); say "final message to the user, not any report or plan file".
6. shared/fix-reviewer-brief.md:15 "pre-0.14.0 plan" is a comb version citation; say "plan predates the Check: field".
7. help SKILL.md:295-298 patterns "Config knobs" third column misaligned.
8. help (overview + configure entry) doesn't mention migration.
9. configure description says "carry over"; notice/README say "migrate" — use the trigger verb.
10. patterns offers the manifest move at Step 4, after recon and the scan gate; CHANGELOG says "before a scan". Moving it right after Step 1 is a spec change.
11. README Status "full version history" is inaccurate now (history is linked from 0.1.0).
12. migrate manifest filesystem errors (target parent is a file, read-only dirs, unreadable source) → traceback/exit 1; a failed move from a read-only dir leaves both copies.
13. Tests miss: comb `paths: null`, two-layer paths.patterns precedence, manifest-as-directory, realpath vs abspath of printed paths (norm maps both to TMP), warning+notice stderr order, moved/copied content, stale expected files.
14. Guard misses identifier shapes `_comb`, `combs_`, `CombConfig`-style camel case (none exist today).
15. Guard reports every exempt line when the user's git config has `color.ui=always`; add `--no-color`.
16. Guard path scan ignores grep's exit status; self-test doesn't cover the `git grep` rc>1 branches.
17. Case-only different spellings of the same dir on macOS give two notices (realpath keeps case); use samefile.
18. Pre-existing from comb: megamaid's own `load_layer` crashes on a non-UTF-8 megamaid.config.json (same gap as fixed above).

Also found while fixing #16: an unreadable tracked file makes `git grep` print an error but exit 1, the same as "no match"; the guard now fails closed on any git grep stderr (self-test added).
