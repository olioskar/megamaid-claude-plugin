# /megamaid:patterns

`/megamaid:patterns [focus brief]` writes the PATTERNS manifest; `/megamaid:patterns --shave [focus brief]` shrinks one.

## The manifest

At `paths.patterns` (default `docs/megamaid/PATTERNS.md`; `null` turns manifest use off in review, plan and fix). A header (`Generated`, `Base commit`, `megamaid version`, `Scan areas`; `Shaved` after a shave) and one `##` section per scan area, opening with `_Scope: <globs>_` and holding only the `###` lenses with content: structural conventions, naming and vocabulary, closed sets, abstraction calibration, reuse points, error handling and async, testing conventions. Every entry is a fact with a `path:line` anchor (`canonical: path:line` where one exists), never a principle; the body records directive-conforming conventions only. Add a one-line `Home: <globs>` to a section the excerpt includes too often: with a scope line present, the section is matched by its globs and exact anchors only, not by the directories its anchors sit in.

## Generate

1. Config; then, when `megamaid.py config` reports a manifest from an earlier install at a path megamaid does not read, the offer to move it, copy it, or skip (the notice repeats until a manifest exists at `paths.patterns`).
2. Recon without deep reads: build manifests, directory shape, extension mix. Scan areas are proposed as label plus path scope; generated, vendored, and reference-only regions (per `CLAUDE.md`) are set aside.
3. The one hard stop: areas, exclusions, directive-to-area mapping, and directive currency in one prompt; `go` accepts all. An existing manifest asks regenerate or cancel.
4. One `pattern-scanner` per area, in parallel, lane `patterns`, with only the directives mapped to its area (by path) and the focus brief. It reads code and returns markdown per `shared/scan-rules.md`, classifying each candidate against the directives: conforming or net-new is recorded; a minority deviation is drift and dropped; a dominant area-wide deviation goes to a separate conflicts list.
5. Dominant conflicts, if any, are put to you: directive stale (record the practice, tagged `supersedes`), drift (keep the directive, list the files), or skip.
6. Pre-write review: entries per area with thin or empty areas flagged, `manifest.py anchors` (file exists, line within it, basename not ambiguous), `rescan <area>` for one area, and a section-level diff against an existing manifest.
7. `write`: the file, its size and token estimate (above 100 KB, a notice to shave), and the reconciliation outcomes (directives to update, drift to fix, unresolved conflicts).

## Shave

`--shave` reduces token cost without changing what the manifest asserts; it never rescans. It stops with a message when there is no manifest at `paths.patterns`, when no area section is 4 KB or more, or when no shaver produced a usable edit script.

1. `manifest.py index` prints every section with its line range and bytes; the focus brief can narrow the sections.
2. One `pattern-shaver` per area section of 4 KB or more, at most five at a time; header and global sections are never edited. A shaver opens its section by line range, reads code only to confirm two anchors pin one convention, and writes one JSON edit script. Three operations only: drop a secondary anchor, replace a bullet restated from another section with `See <owner>.`, drop a drift line whose items are all fixed. The orchestrator compares the manifest's byte count before and after dispatch; a shaver that edited the file ends the shave with nothing applied.
3. `manifest.py verify` rejects every edit that fails the mechanical checks (text occurs once in its section, no heading removed, every removed anchor survives elsewhere).
4. The gate, the mode's one hard stop: counts per section and class, every edit in full; `apply`, `skip <class>`, `skip <section>`, `show <section>`.
5. `manifest.py apply` writes all-or-nothing after re-verifying, and stamps `Shaved: <date> (<before> → <after> bytes)`.

## How review, plan, and fix use it

They never read the manifest. `manifest.py excerpt` cuts a per-run excerpt from the touched text (review: the diff's file list; plan: the report; fix: the instruction folder), and agents get the excerpt path and the full path in their run brief. Which sections travel is in `shared/manifest-slicing.md`; the excerpt opens with the omitted sections and their line ranges, so an agent can read one with `sed -n START,ENDp`.

Each summary echoes `PATTERNS excerpt: <n> of <m> area sections included …` and a staleness note when the manifest's base commit is behind the cited files it touches. When the cut fails, the full path is delivered with a notice; an empty touched set counts as a failure, never as a silent full delivery.
