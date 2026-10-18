---
name: Trust the model — don't enumerate language quirks in prompts
description: When fixing language/paradigm bias in agent prompts or skill bodies, drop the bias and trust the model to apply per-language idioms — don't replace it with an exhaustive multi-language catalogue
type: feedback
originSessionId: 89ed27bf-94c9-4cf1-88d2-f19c563f4a82
---
When an agent prompt has a language-specific bias (e.g., listing `??`/`?.`/`.catch()` as fallback patterns when those are JS/TS-only), the right fix is to **abstract the concept** ("nullish/short-circuit operators, ignored error returns, optional chaining for guaranteed values") — not to swap the JS list for a Rust + Go + Python + PHP enumeration.

**Why:** Opus already knows the per-language idioms from training. Listing `unwrap_or` (Rust), `_, err :=` (Go), `except: pass` (Python), empty `catch {}` (Java/C#/PHP), `console.error` (JS) inline adds tokens without adding judgment. The model can resolve the abstract pattern to the language at hand on its own. Direct callout from olafur on 2026-05-05 after I over-corrected silent-failure-hunter and the review verification table from JS-biased to a 13-row multi-language catalogue.

**How to apply:** When generalizing a paradigm-biased prompt, the diff should *shrink* (remove the bias) — not grow (add an enumeration). One concrete signal: if the fix adds 30+ lines of language-specific examples, you're probably overengineering. Trust the model unless it has demonstrated a specific blind spot.
