# Phase 1: mod skeleton — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** megamaid gains a tested hooks module that fails every working skill closed when the module is not loaded, and records megamaid runs and the agents they dispatch (role and lane).

**Architecture:** One hooks module (`hooks/register.ts`) wires four small registration files: `skill-prompt.ts` (strip the stop line, start a run), `read-note.ts` (tell the model the stop line in a Read sub-skill file does not apply), `agents.ts` (record megamaid's dispatches), `session.ts` (log load, clear the run). Pure helpers live in `run.ts` and `stop-line.ts`. Run state is one `$.state` value typed in `types/index.d.ts`. Gates gain `tsc` against vendored engine types and `claude plugin test`.

**Tech Stack:** Claude Code 2.1.296 hooks-module API (`claude-code`, `claude-code/testing`), TypeScript 5.9.3 via `npx`, bash gates, python3 (existing scripts).

**Spec:** `docs/superpowers/specs/2026-10-13-megamaid-mod-skeleton-design.md` (rev 3). Evidence: `docs/superpowers/specs/2026-10-12-phase1-spike-findings.md`. A working skeleton of rev 2 + the round-2 Critical fix exists at `/private/tmp/claude-501/-Users-olafur-Development-megamaid-claude-plugin/ad5801e8-4a8d-43c8-8ac9-9d906fc6560a/scratchpad/review2-code/skeleton` (reference only; this plan supersedes it where they differ).

## Global Constraints

- Branch `feat/v0.2.0-mod-skeleton` off `main`; `main` changes only through the PR. Push only on the maintainer's go.
- One commit per task, `type(scope): summary`; commit messages end with the session's Co-Authored-By / Claude-Session lines.
- Claude Code version single source: first line of `vendor/claude-code-types/claude-code/index.d.ts`, `// Written by Claude Code 2.1.296.`
- TypeScript: `npx -y -p typescript@5.9.3 tsc -p .`, pinned in `scripts/check-contract.sh` only.
- Imports between plugin files are extensionless (`from './stop-line'`).
- A state ref is a literal const in each file that passes it to `$.state.*` or `update`: `const RUN = { plugin: 'megamaid', key: 'run' } as const`.
- `$` is never passed across an import: each `register*(on)` registers its hooks inline.
- Every log line: `$.ui.log(text, { to: 'debug' })`, text without a `megamaid:` prefix (the engine adds the plugin name). `$.ui.log` returns `void` (types line 2420).
- Stop line (exact): ``STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`.``
- `SKIP_NOTE` (exact): `megamaid's hooks module is loaded; the STOP line at the top of this file does not apply.`
- Stop-line skills: every `skills/*/SKILL.md` except help: configure, fix, fix-auto, patterns, plan, review, vacu-suck.
- Every test is written first and seen to fail; a negative test carries a positive control in the same body.
- Free gates on every commit: `claude plugin validate .` and `bash scripts/check-contract.sh`. No paid run outside the "After the tasks" section; say the cost before each paid run.
- Prose plain; no knobs, fields or sections the spec does not name.

## Review Focus

Input classes the spec implies but its test list does not exercise, most likely first. Each has a test in the owning task.

1. A skill file with CRLF line endings (a Windows checkout made before `.gitattributes`, or an editor): the stop line still strips; otherwise a loaded module gives a false stop. Test in Task 3.
2. The plugin root itself reached through a symlink (marketplace cache dir, a symlinked dev checkout): the Read note still applies. Covered by every Read-note test in Task 5 (the kit's root resolves to another spelling, `REAL`); the root as the kit reports it, unresolved, is shown by the live check and the vacu-suck / fix-auto eval cases.
3. A brief-carrying spawn when no run is stored (after `/clear`, or a hand dispatch with a brief): recorded under a fresh `none` run, not dropped. Test in Task 6.
4. `megamaid:help` through the strip hook: text unchanged and no run started (help has no stop line; the matcher still selects it). Test in Task 3.
5. A provider string without `@` (`megamaid`): treated as megamaid's own during a patterns run. Test in Task 6.

---

### Task 1: Engine scaffolding and the engine gate

Puts in place everything `tsc` and `claude plugin test` need, with one real test, and the gate section that runs them. Fail first: the gate section is added before the module exists.

**Files:**
- Create: `scripts/sync-types.sh`, `scripts/test-sync-types.sh`, `vendor/claude-code-types/claude-code/index.d.ts`, `vendor/claude-code-types/claude-code-tools/index.d.ts` (copied), `tsconfig.json`, `.gitattributes`, `hooks/hooks.json`, `hooks/register.ts`, `hooks/stop-line.ts`, `hooks/stop-line.test.ts`, `hooks/test-rig.ts`, `types/index.d.ts`
- Modify: `.claude-plugin/plugin.json` (add `"types"`), `.gitignore`, `scripts/check-contract.sh` (header, tool check, §5 runs the sync fixture test, §10 exempt, new §12)

**Interfaces:**
- Produces: `STOP_LINE`, `STOP_TOKEN`, `TOKEN_LINE`, `SKIP_NOTE`, `STOP_SKILLS`, `stripStopLine(text: string): string` from `hooks/stop-line.ts`; `rig(on, opts?)`, `Rig`, `spawnInput(over?)`, `endInput()`, `MEGAMAID`, `FOREIGN`, `briefPath(stem, lane, role)` from `hooks/test-rig.ts`; types `MegamaidAgent`, `MegamaidRun` from `types/index.d.ts`; `MIN_TESTS` in check-contract §12.

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/v0.2.0-mod-skeleton
```

- [ ] **Step 2: Write the sync script's fixture test (fails: no script yet)**

`scripts/test-sync-types.sh`:

```bash
#!/usr/bin/env bash
# Fixture test for scripts/sync-types.sh. Runs against a temp copy of the repo layout.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
t=$(mktemp -d "${TMPDIR:-/tmp}/sync-types.XXXXXX")
mkdir -p "$t/repo/scripts" "$t/src/claude-code" "$t/src/claude-code-tools"
cp scripts/sync-types.sh "$t/repo/scripts/"
printf '// Written by Claude Code 9.8.7.\nexport {}\n' > "$t/src/claude-code/index.d.ts"
printf '// tools\n' > "$t/src/claude-code-tools/index.d.ts"

out=$(bash "$t/repo/scripts/sync-types.sh" "$t/src" 2>&1); rc=$?
[ "$rc" = 0 ] || { echo "FAIL: sync-types on a good source exited $rc: $out"; fail=1; }
[ "$out" = "sync-types: vendor/claude-code-types now holds Claude Code 9.8.7" ] || { echo "FAIL: sync-types said: $out"; fail=1; }
cmp -s "$t/src/claude-code/index.d.ts" "$t/repo/vendor/claude-code-types/claude-code/index.d.ts" || { echo "FAIL: claude-code not copied"; fail=1; }
cmp -s "$t/src/claude-code-tools/index.d.ts" "$t/repo/vendor/claude-code-types/claude-code-tools/index.d.ts" || { echo "FAIL: claude-code-tools not copied"; fail=1; }

rm "$t/src/claude-code-tools/index.d.ts"
out=$(bash "$t/repo/scripts/sync-types.sh" "$t/src" 2>&1); rc=$?
[ "$rc" = 1 ] && [[ "$out" == *"claude-code-tools/index.d.ts not found"* ]] || { echo "FAIL: missing tools file: exit $rc, $out"; fail=1; }

printf '// tools\n' > "$t/src/claude-code-tools/index.d.ts"
printf '// something else\n' > "$t/src/claude-code/index.d.ts"
out=$(bash "$t/repo/scripts/sync-types.sh" "$t/src" 2>&1); rc=$?
[ "$rc" = 1 ] && [[ "$out" == *"no 'Written by Claude Code X.' first line"* ]] || { echo "FAIL: bad first line: exit $rc, $out"; fail=1; }

rm -rf "$t"
[ "$fail" -eq 0 ] && echo "test-sync-types: OK"
exit "$fail"
```

Run: `bash scripts/test-sync-types.sh`
Expected: FAIL lines (no `scripts/sync-types.sh` to copy), non-zero exit.

- [ ] **Step 3: Write `scripts/sync-types.sh`**

```bash
#!/usr/bin/env bash
# Copy the engine-written hooks-module types into vendor/claude-code-types/, the pinned copy
# that tsc and CI use. Usage: scripts/sync-types.sh [<laid types folder>]
# Default source: .claude-plugin/types, which an interactive `claude --plugin-dir .` writes.
# <laid types folder> is absolute or relative to the repo root (the script cds there first).
# Commit the result on its own: `chore(types): Claude Code X`.
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:-.claude-plugin/types}"
for d in claude-code claude-code-tools; do
  [ -f "$src/$d/index.d.ts" ] || { echo "sync-types: $src/$d/index.d.ts not found" >&2; exit 1; }
done
v=$(sed -n '1s/^\/\/ Written by Claude Code \([0-9][0-9.]*[0-9]\)\.$/\1/p' "$src/claude-code/index.d.ts")
[ -n "$v" ] || { echo "sync-types: $src/claude-code/index.d.ts has no 'Written by Claude Code X.' first line" >&2; exit 1; }
for d in claude-code claude-code-tools; do
  mkdir -p "vendor/claude-code-types/$d"
  cp "$src/$d/index.d.ts" "vendor/claude-code-types/$d/index.d.ts"
done
echo "sync-types: vendor/claude-code-types now holds Claude Code $v"
```

Run: `chmod +x scripts/sync-types.sh scripts/test-sync-types.sh && bash scripts/test-sync-types.sh`
Expected: `test-sync-types: OK`

- [ ] **Step 4: Vendor the 2.1.296 types**

```bash
bash scripts/sync-types.sh /Users/olafur/.claude/dev-mods/38955e1f-96ca-4065-9db1-350ab47919df/skjar-next/.claude-plugin/types
```
Expected: `sync-types: vendor/claude-code-types now holds Claude Code 2.1.296`

Commit the vendored copy on its own (the spec: a types refresh is its own commit):

```bash
git add vendor/claude-code-types
git commit -m "chore(types): Claude Code 2.1.296"
```

- [ ] **Step 5: Add the engine gate section to `scripts/check-contract.sh` (fails first)**

Change the header comment line 3 to:

```bash
# Needs claude and node (npx) on PATH; the first npx run needs network. Run from anywhere.
```

After `fail=0`, add:

```bash
for tool in claude node npx; do
  command -v "$tool" >/dev/null 2>&1 || { echo "FAIL: $tool is not on PATH (check-contract needs claude, node and npx)"; exit 1; }
done
```

In §5, next to the other fixture-test runs, add:

```bash
bash scripts/test-sync-types.sh >/dev/null 2>&1 || { echo "FAIL: scripts/test-sync-types.sh failed (run it for the diff)"; fail=1; }
```

In §10 change the comment's "Exempt: CHANGELOG.md, scripts/migrate.py, scripts/fixtures/migrate/," to "Exempt: CHANGELOG.md, scripts/migrate.py, scripts/fixtures/migrate/, vendor/claude-code-types/ (engine text)," and change `GUARD_EXEMPT` to:

```bash
GUARD_EXEMPT='^(CHANGELOG\.md|scripts/migrate\.py|scripts/fixtures/migrate/|vendor/claude-code-types/)'
```

Before the final `if [ "$fail" -eq 0 ]`, add:

```bash
# 12. Engine: the vendored types name the Claude Code in use (CI must match; locally a mismatch
#     warns), the module type-checks, and its tests run and pass.
MIN_TESTS=1
tv=$(sed -n '1s/^\/\/ Written by Claude Code \([0-9][0-9.]*[0-9]\)\.$/\1/p' vendor/claude-code-types/claude-code/index.d.ts 2>/dev/null)
cv=$(claude --version 2>/dev/null | sed -n '1s/^\([0-9][0-9.]*[0-9]\) (Claude Code)$/\1/p')
if [ -z "$tv" ]; then
  echo "FAIL: vendor/claude-code-types/claude-code/index.d.ts names no Claude Code version"; fail=1
elif [ "$tv" != "$cv" ]; then
  if [ -n "${CI:-}" ]; then
    echo "FAIL: vendored types are Claude Code $tv, claude --version is '$cv'"; fail=1
  else
    echo "WARN: vendored types are Claude Code $tv, this claude is '$cv'. To refresh: run 'claude --plugin-dir .' once, exit, then scripts/sync-types.sh, and commit as 'chore(types): Claude Code <version>'."
  fi
fi
if ! out=$(npx -y -p typescript@5.9.3 tsc -p . 2>&1); then echo "$out"; echo "FAIL: tsc -p ."; fail=1; fi
cfg=$(mktemp -d "${TMPDIR:-/tmp}/plugin-test.XXXXXX")
out=$(CLAUDE_CONFIG_DIR="$cfg" claude plugin test . 2>&1); rc=$?
rm -rf "$cfg"
ran=$(printf '%s\n' "$out" | sed -nE 's/^Ran ([0-9]+) tests? across [0-9]+ files?\..*/\1/p')
if printf '%s\n' "$out" | grep -q '^claude plugin test:'; then
  printf '%s\n' "$out" | grep '^claude plugin test:'; echo "FAIL: claude plugin test refused"; fail=1
elif [ "$rc" != 0 ] || [ -z "$ran" ] || [ "$ran" -lt "$MIN_TESTS" ] || ! printf '%s\n' "$out" | grep -qx ' 0 fail'; then
  printf '%s\n' "$out" | grep -v '^(pass)'; echo "FAIL: claude plugin test (exit $rc, ran '${ran:-?}', want >= $MIN_TESTS and 0 fail)"; fail=1
fi
```

Run: `bash scripts/check-contract.sh`
Expected: `FAIL: tsc -p .` (no tsconfig/inputs) and `FAIL: claude plugin test …` (no module); non-zero exit.

- [ ] **Step 6: Add the TypeScript and git configuration**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noEmit": true, "skipLibCheck": false,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": ["vendor/claude-code-types", "hooks", "types"]
}
```

`.gitattributes`:

```
*.md text eol=lf
*.ts text eol=lf
```

Append to `.gitignore`:

```
# Engine-written hooks types (laid on each interactive --plugin-dir load); the pinned copy is vendor/claude-code-types/
.claude-plugin/types/
```

- [ ] **Step 7: Add the contract, the constants, the rig and the first test**

`types/index.d.ts`:

```ts
export type MegamaidAgent = { subagentType: string; provider: string; role: string; lane: string | null; runStem: string | null }
export type MegamaidRun = { id: string; skill: string; startedAt: number; agents: Record<string, MegamaidAgent> }
declare module 'claude-code' {
  interface PluginState {
    megamaid: { run: MegamaidRun | null }
  }
}
```

In `.claude-plugin/plugin.json`, change the closing `  ]` of `keywords` to `  ],` and add after it:

```json
  "types": "./types/index.d.ts"
```

`hooks/hooks.json`:

```json
{ "modules": ["./register.ts"] }
```

`hooks/stop-line.ts`:

```ts
// The stop line is copied into every skill but help (check-contract §11 keeps the copies equal to
// STOP_LINE). The module strips it; with no module the model reads it and stops.
export const STOP_LINE = "STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`."
export const STOP_TOKEN = 'MEGAMAID-MODULE-NOT-LOADED'
export const TOKEN_LINE = 'MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help'
export const SKIP_NOTE = "megamaid's hooks module is loaded; the STOP line at the top of this file does not apply."
export const STOP_SKILLS: readonly string[] = ['configure', 'fix', 'fix-auto', 'patterns', 'plan', 'review', 'vacu-suck']

export function stripStopLine(text: string): string {
  return text
}
```

(`stripStopLine` is completed in Task 3, test first.)

`hooks/register.ts`:

```ts
import type { Register } from 'claude-code'

export const register: Register = () => {}
```

`hooks/test-rig.ts`:

```ts
import { mock } from 'claude-code/testing'
import type { AgentSpawnInput, On, SessionEndInput } from 'claude-code'
import type { MegamaidRun } from '../types'

export type Rig = { logs: string[]; writes: (MegamaidRun | null)[] }

// Shared setup. Register every test hook before the test's first $ call (the kit refuses later ones).
// A clock (unless withheld), a ui.log answer that collects lines, and a state.set recorder that keeps
// each landed write (the test's $ has no state noun; next(e) lets update()'s ifVersion retry work).
export function rig(on: On, opts: { clock?: boolean } = {}): Rig {
  if (opts.clock !== false) mock.clock(on, { now: 1000 })
  const logs: string[] = []
  on('ui.log', (_$, e) => { logs.push(e.text); return { value: undefined } })
  const writes: (MegamaidRun | null)[] = []
  on('state.set', async (_$, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.value.isSet) writes.push(e.value as MegamaidRun | null)
    return r
  })
  return { logs, writes }
}

export const MEGAMAID = { plugin: 'megamaid@inline', tier: 'user' } as const
export const FOREIGN = { plugin: 'other@market', tier: 'user' } as const

export function spawnInput(over: Partial<AgentSpawnInput> = {}): AgentSpawnInput {
  return {
    tool_use_id: 't1', prompt: 'do it', description: 'd', subagentType: 'megamaid:code-reviewer',
    provider: MEGAMAID, parentModel: 'claude-opus-5-5', background: false, fork: false, ...over,
  }
}

export function endInput(): SessionEndInput {
  return { reason: 'clear', sessionId: 's1', resume: { id: 's1' } }
}

export function briefPath(stem: string, lane: string, role: string): string {
  return `/w/.megamaid/excerpts/${stem}.${lane}.${role}.brief.md`
}
```

`hooks/stop-line.test.ts`:

```ts
import { test, expect } from 'claude-code/testing'
import { STOP_LINE, STOP_TOKEN, TOKEN_LINE } from './stop-line'

test('the stop line asks for exactly TOKEN_LINE, which leads with STOP_TOKEN', () => {
  expect(STOP_LINE).toContain('`' + TOKEN_LINE + '`')
  expect(TOKEN_LINE.startsWith(STOP_TOKEN + ':')).toBe(true)
})
```

- [ ] **Step 8: Run the gates**

Run: `claude plugin validate . && bash scripts/check-contract.sh`
Expected: validate passes and reports `types ./types/index.d.ts declares state: megamaid.run`; check-contract prints `check-contract: OK` (a version WARN is fine locally only if your Claude Code is not 2.1.296).

- [ ] **Step 9: Commit**

```bash
git add scripts/sync-types.sh scripts/test-sync-types.sh tsconfig.json .gitattributes .gitignore \
  hooks/hooks.json hooks/register.ts hooks/stop-line.ts hooks/stop-line.test.ts hooks/test-rig.ts types/index.d.ts \
  .claude-plugin/plugin.json scripts/check-contract.sh
git commit -m "feat(hooks): module scaffolding, tsc and plugin-test gate"
```

---

### Task 2: CI runs the engine gate on the pinned version

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the vendored types' first line (Task 1).

- [ ] **Step 1: Pin the CLI in both jobs**

In both `contract` and `evals` jobs, replace the `Install Claude Code CLI` step's `run:` with:

```yaml
        run: npm install -g "@anthropic-ai/claude-code@$(sed -n '1s/^\/\/ Written by Claude Code \([0-9][0-9.]*[0-9]\)\.$/\1/p' vendor/claude-code-types/claude-code/index.d.ts)"
```

Rename the `contract` job's step titled `Contract greps and manifest script tests (python3 ships on ubuntu-latest)` to `Contract greps, script tests, tsc and plugin tests (python3 and node ship on ubuntu-latest)`.

- [ ] **Step 2: Gate locally, commit**

Run: `claude plugin validate . && bash scripts/check-contract.sh` → `check-contract: OK`

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install the Claude Code version the vendored types name"
```

- [ ] **Step 3: CI dry run (needs the maintainer's go)**

`ci.yml` runs on pushes to `main`, on pull requests and on `workflow_dispatch`, so a branch push alone starts nothing. Never use `workflow_dispatch` here: it also starts the `evals` job, which spends tokens (up to 20 USD). Ask: "Push `feat/v0.2.0-mod-skeleton` and open a draft PR for a CI dry run of the engine gate?" On go:

```bash
git push -u origin feat/v0.2.0-mod-skeleton
gh pr create --draft --base main --title "Phase 1: hooks module skeleton (draft, CI dry run)" \
  --body "$(printf 'Draft for the CI dry run of the engine gate (Task 2 of the Phase 1 plan). Not ready for review.\n\nOn behalf of @olioskar by Claude\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n')"
gh pr checks --watch
```

Expected: the `contract` job passes, including `tsc` and `claude plugin test`; the `evals` job is skipped (it runs on `workflow_dispatch` only). If `claude plugin test` refuses (rollout switch) or the job fails outside the plugin, stop and report the log to the maintainer; do not work around the runner. Record the outcome in the ledger.

---

### Task 3: Strip the stop line and start runs

**Files:**
- Create: `hooks/skill-prompt.ts`, `hooks/run.ts`, `hooks/run.test.ts`
- Modify: `hooks/stop-line.ts` (`stripStopLine`), `hooks/stop-line.test.ts`, `hooks/register.ts`, `scripts/check-contract.sh` (`MIN_TESTS=11`)

**Interfaces:**
- Consumes: `STOP_LINE`, `stripStopLine`, `rig`, `endInput` (Task 1).
- Produces: `registerSkillPrompt(on: On): void`; from `hooks/run.ts`: `isRunSkill(name: string): boolean`, `startRun(id: string, skill: string, startedAt: number): MegamaidRun`.

- [ ] **Step 1: Write the failing tests**

Append to `hooks/stop-line.test.ts` (and add `import { rig } from './test-rig'`):

```ts
const BASE = 'Base directory for this skill: /p/skills/review\n\n'

test('the stop line is removed from a megamaid skill wherever it stands', async ($, on) => {
  rig(on)
  let text = ''
  on('skill.prompt', () => ({ text }))
  for (const raw of [STOP_LINE + '\nbody', BASE + STOP_LINE + '\nbody', 'a\n' + STOP_LINE + '\nb\n' + STOP_LINE]) {
    text = raw
    expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).not.toContain(STOP_LINE)
  }
})

test('another plugin keeps the line (control: megamaid strips it)', async ($, on) => {
  rig(on)
  on('skill.prompt', () => ({ text: STOP_LINE + '\nbody' }))
  expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).toBe('body')
  expect((await $.skill.prompt({ skill: 'other:review', text: 'x' })).text).toBe(STOP_LINE + '\nbody')
})

test('text without the line is unchanged (control: with it, stripped)', async ($, on) => {
  rig(on)
  let text = BASE + STOP_LINE + '\nbody'
  on('skill.prompt', () => ({ text }))
  expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).toBe(BASE + 'body')
  text = BASE + 'body\n\nmore'
  expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).toBe(text)
})

test('a near-miss line is kept (control: the exact line is stripped)', async ($, on) => {
  rig(on)
  const near = STOP_LINE + ' '
  on('skill.prompt', () => ({ text: near + '\n' + STOP_LINE + '\nbody' }))
  expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).toBe(near + '\nbody')
})

test('a CRLF-ended stop line is stripped too', async ($, on) => {
  rig(on)
  on('skill.prompt', () => ({ text: BASE.replace(/\n/g, '\r\n') + STOP_LINE + '\r\nbody\r\n' }))
  expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).not.toContain(STOP_LINE)
})

test('help passes through unchanged and starts no run (control: review starts one)', async ($, on) => {
  const { writes } = rig(on)
  on('skill.prompt', () => ({ text: BASE + 'help body' }))
  expect((await $.skill.prompt({ skill: 'megamaid:help', text: 'x' })).text).toBe(BASE + 'help body')
  expect(writes).toHaveLength(0)
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  expect(writes).toHaveLength(1)
})

test('isolation: run start fails (no clock), the line is still stripped and the failure logged', async ($, on) => {
  const { logs } = rig(on, { clock: false })
  on('skill.prompt', () => ({ text: STOP_LINE + '\nbody' }))
  expect((await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })).text).toBe('body')
  expect(logs.some(l => l.startsWith('run detection failed: '))).toBe(true)
})
```

`hooks/run.test.ts`:

```ts
import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import { rig } from './test-rig'

function answerSkills(on: On) {
  on('skill.prompt', () => ({ text: 'body' }))
}

test('a megamaid skill starts a run', async ($, on) => {
  const { writes, logs } = rig(on)
  answerSkills(on)
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ skill: 'megamaid:review', startedAt: 1000, agents: {} })
  expect(logs.some(l => /^run megamaid:review started \(.+\)$/.test(l))).toBe(true)
})

test('megamaid:help does not replace the run (control: review starts one)', async ($, on) => {
  const { writes } = rig(on)
  answerSkills(on)
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.skill.prompt({ skill: 'megamaid:help', text: 'x' })
  expect(writes).toHaveLength(1)
  expect(writes[0]?.skill).toBe('megamaid:review')
})

test('a second skill replaces the run', async ($, on) => {
  const { writes } = rig(on)
  answerSkills(on)
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  expect(writes.map(w => w?.skill)).toEqual(['megamaid:review', 'megamaid:plan'])
  expect(writes[0]?.id).not.toBe(writes[1]?.id)
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `claude plugin test .` (if it refuses on the rollout switch, run `CLAUDE_CONFIG_DIR="$(mktemp -d)" claude plugin test .`, as check-contract does; the same holds in later tasks)
Expected: the new stop-line and run tests FAIL (nothing strips; no run is written); the Task 1 constant test passes.

- [ ] **Step 3: Implement**

`hooks/stop-line.ts`, replace `stripStopLine`:

```ts
export function stripStopLine(text: string): string {
  return text.split('\n').filter(line => line.replace(/\r$/, '') !== STOP_LINE).join('\n')
}
```

`hooks/run.ts`:

```ts
import type { MegamaidRun } from '../types'

// Pure helpers for run detection. No $ here, and no state ref: each file that writes state
// declares its own RUN const (validate reads a ref only as a literal const of that file).

export function isRunSkill(name: string): boolean {
  return name.startsWith('megamaid:') && name !== 'megamaid:help'
}

export function startRun(id: string, skill: string, startedAt: number): MegamaidRun {
  return { id, skill, startedAt, agents: {} }
}
```

`hooks/skill-prompt.ts`:

```ts
import { update } from 'claude-code'
import type { On } from 'claude-code'
import { stripStopLine } from './stop-line'
import { isRunSkill, startRun } from './run'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// One registration on purpose: if a second skill.prompt hook of this plugin threw, the strip would
// be lost and a loaded module would read as "not loaded". Run start sits in try; the .catch
// replays next (nothing beneath runs twice) and strips, so an overrun cannot cost the strip either.
export function registerSkillPrompt(on: On): void {
  on('skill.prompt', { skill: /^megamaid:/ }, async ($, e, next) => {
    const text = stripStopLine((await next(e)).text)
    try {
      if (isRunSkill(e.skill)) {
        const run = startRun(crypto.randomUUID(), e.skill, await $.clock.now())
        await update($, RUN, () => run)
        $.ui.log(`run ${e.skill} started (${run.id})`, { to: 'debug' })
      }
    } catch (err) {
      $.ui.log(`run detection failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
    }
    return { text }
  }).catch(async ($, e, next) => ({ text: stripStopLine((await next(e)).text) }))
}
```

`hooks/register.ts`:

```ts
import type { Register } from 'claude-code'
import { registerSkillPrompt } from './skill-prompt'

export const register: Register = on => {
  registerSkillPrompt(on)
}
```

In `scripts/check-contract.sh` §12 set `MIN_TESTS=11`.

- [ ] **Step 4: Run tests and gates**

Run: `claude plugin test . && claude plugin validate . && bash scripts/check-contract.sh`
Expected: 11 pass, 0 fail; validate lists `skill.prompt{skill=/"^megamaid:"/}`, `state writes: megamaid.run` and `state reads: megamaid.run` (on two lines; `update` reads); `check-contract: OK`.

- [ ] **Step 5: Commit**

```bash
git add hooks/ scripts/check-contract.sh
git commit -m "feat(hooks): strip the stop line from megamaid skills and start a run"
```

---

### Task 4: The stop line in every working skill, gated

**Files:**
- Modify: `skills/{configure,fix,fix-auto,patterns,plan,review,vacu-suck}/SKILL.md`, `scripts/check-contract.sh` (new §11)

**Interfaces:**
- Consumes: `STOP_LINE`, `STOP_SKILLS` lines in `hooks/stop-line.ts` (Task 1).

- [ ] **Step 1: Add §11 to `scripts/check-contract.sh` (fails first)**

Insert before §12:

```bash
# 11. Stop line: one source (hooks/stop-line.ts), copied as the first non-blank line after the
#     frontmatter of every skill but help, exactly once; never in help. STOP_SKILLS names them.
n=$(grep -c '^export const STOP_LINE = "' hooks/stop-line.ts 2>/dev/null)
STOP_LINE=$(sed -n 's/^export const STOP_LINE = "\(.*\)"$/\1/p' hooks/stop-line.ts 2>/dev/null)
if [ "$n" != 1 ] || [ -z "$STOP_LINE" ]; then
  echo "FAIL: hooks/stop-line.ts must hold exactly one line: export const STOP_LINE = \"...\""; fail=1
else
  case "$STOP_LINE" in *'"'*|*'\'*) echo "FAIL: STOP_LINE holds a double quote or a backslash"; fail=1;; esac
  want=$(ls skills | grep -vx help | sort | tr '\n' ' ')
  have=$(sed -n "s/^export const STOP_SKILLS: readonly string\[\] = \[\(.*\)\]$/\1/p" hooks/stop-line.ts | tr -d "' " | tr ',' '\n' | sort | tr '\n' ' ')
  [ "$want" = "$have" ] || { echo "FAIL: STOP_SKILLS ($have) differs from the skills other than help ($want)"; fail=1; }
  for s in $want; do
    f=skills/$s/SKILL.md
    c=$(grep -cxF -- "$STOP_LINE" "$f")
    [ "$c" = 1 ] || { echo "FAIL: $f carries the stop line $c times (want 1)"; fail=1; }
    first=$(awk 'NR==1 && /^---$/ {fm=1; next} fm==1 && /^---$/ {fm=2; next} fm==2 && NF {print; exit}' "$f")
    [ "$first" = "$STOP_LINE" ] || { echo "FAIL: $f: the stop line is not the first non-blank line after the frontmatter"; fail=1; }
  done
  ! grep -qxF -- "$STOP_LINE" skills/help/SKILL.md || { echo "FAIL: skills/help/SKILL.md carries the stop line"; fail=1; }
fi
```

Run: `bash scripts/check-contract.sh`
Expected: seven `carries the stop line 0 times` and seven `not the first non-blank line` FAILs.

- [ ] **Step 2: Insert the line**

```bash
python3 -I - <<'EOF'
import re
line = re.search(r'^export const STOP_LINE = "(.*)"$', open('hooks/stop-line.ts').read(), re.M).group(1)
for s in ['configure', 'fix', 'fix-auto', 'patterns', 'plan', 'review', 'vacu-suck']:
    p = f'skills/{s}/SKILL.md'
    t = open(p).read()
    end = t.index('\n---\n', 4) + len('\n---\n')
    rest = t[end:]
    assert rest.startswith('\n'), p
    open(p, 'w').write(t[:end] + '\n' + line + '\n' + rest)
EOF
```

- [ ] **Step 3: Run the gates**

Run: `claude plugin validate . && bash scripts/check-contract.sh`
Expected: `check-contract: OK`. Also run `git diff --stat skills/` → 7 files, 2 insertions each.

- [ ] **Step 4: Commit**

```bash
git add skills/ scripts/check-contract.sh
git commit -m "feat(skills): every working skill opens with the stop line; check-contract keeps the copies equal"
```

---

### Task 5: The Read note for sub-skill files

**Files:**
- Create: `hooks/read-note.ts`, `hooks/read-note.test.ts`
- Modify: `hooks/test-rig.ts` (Read-test answerers), `hooks/register.ts`, `scripts/check-contract.sh` (`MIN_TESTS=15`)

**Interfaces:**
- Consumes: `SKIP_NOTE`, `STOP_SKILLS` (Task 1), `rig` (Task 1).
- Produces: `registerReadNote(on: On): void`; in `hooks/test-rig.ts`: `REAL`, `LINK_FILE`, `type ReadAnswer`, `answerStat(on)`, `answerRead(on, how?)`.

- [ ] **Step 1: Write the failing tests**

Append to `hooks/test-rig.ts`:

```ts
// Read-note tests. The kit's $.plugin.root is the plugin folder; fs.stat answers map spellings to
// real paths. Any other path (the plugin root among them) resolves to REAL, so in every Read test
// the root is reached through a different spelling, as a linked root or marketplace cache would be.
// LINK_FILE is a symlinked spelling of review's skill file.
export const REAL = '/real/megamaid'
export const LINK_FILE = '/link/skills/review/SKILL.md'
export function answerStat(on: On): void {
  on('fs.stat', (_$, e) => {
    const realPath = e.path === LINK_FILE ? REAL + '/skills/review/SKILL.md'
      : e.path.startsWith(REAL + '/') || e.path.startsWith('/other/') ? e.path
      : REAL
    return { value: { kind: 'file' as const, size: 1, mtimeMs: 0, isLink: e.path === LINK_FILE, realPath } }
  })
}
export type ReadAnswer = 'ok' | 'deny' | 'error'
export function answerRead(on: On, how: () => ReadAnswer = () => 'ok'): void {
  on('tool.call', { tool: 'Read' }, (_$, e) => {
    const h = how()
    if (h === 'deny') return { deny: 'no' }
    if (h === 'error') return { isError: true as const, result: 'boom', text: 'boom' }
    return { result: { type: 'text' as const, file: { filePath: String(e.file_path), content: 'x', numLines: 1, startLine: 1, totalLines: 1 } } }
  })
}
```

`hooks/read-note.test.ts`:

```ts
import { test, expect } from 'claude-code/testing'
import { SKIP_NOTE } from './stop-line'
import { LINK_FILE, REAL, answerRead, answerStat, rig } from './test-rig'
import type { ReadAnswer } from './test-rig'

test('a main-loop Read of a stop-line skill gains the note, through a symlink too (controls: another SKILL.md and a non-skill file under the root do not)', async ($, on) => {
  rig(on); answerStat(on); answerRead(on)
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/skills/review/SKILL.md' })).context).toEqual([SKIP_NOTE])
  expect((await $.tool.call({ tool: 'Read', file_path: LINK_FILE })).context).toEqual([SKIP_NOTE])
  expect((await $.tool.call({ tool: 'Read', file_path: '/other/skills/review/SKILL.md' })).context).toBeUndefined()
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/shared/x.md' })).context).toBeUndefined()
})

test("help's file and a subagent's Read gain no note (control: review's main-loop Read does)", async ($, on) => {
  rig(on); answerStat(on); answerRead(on)
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/skills/review/SKILL.md' })).context).toEqual([SKIP_NOTE])
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/skills/help/SKILL.md' })).context).toBeUndefined()
  // $.tool.call's type omits agentId (ToolCallArgs, types 12646-12652); the test engine passes it on,
  // so a non-literal object carries it.
  const subagentRead = { tool: 'Read' as const, file_path: REAL + '/skills/review/SKILL.md', agentId: 'sub1' }
  expect((await $.tool.call(subagentRead)).context).toBeUndefined()
})

test('a denied or errored Read is returned unchanged (control: a good one gains the note)', async ($, on) => {
  rig(on); answerStat(on)
  let how: ReadAnswer = 'ok'
  answerRead(on, () => how)
  expect((await $.tool.call({ tool: 'Read', file_path: LINK_FILE })).context).toEqual([SKIP_NOTE])
  how = 'deny'
  expect(await $.tool.call({ tool: 'Read', file_path: LINK_FILE })).toEqual({ deny: 'no' })
  how = 'error'
  const errored = await $.tool.call({ tool: 'Read', file_path: LINK_FILE })
  expect(errored.isError).toBe(true)
  expect(errored.context).toBeUndefined()
})

test('another stop-line skill (vacu-suck) gets the note too', async ($, on) => {
  rig(on); answerStat(on); answerRead(on)
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/skills/vacu-suck/SKILL.md' })).context).toEqual([SKIP_NOTE])
})
```

- [ ] **Step 2: Run to see them fail**

Run: `claude plugin test .`
Expected: the four new tests FAIL (no note is added); the others pass.

- [ ] **Step 3: Implement**

`hooks/read-note.ts`:

```ts
import type { On } from 'claude-code'
import { SKIP_NOTE, STOP_SKILLS } from './stop-line'

// vacu-suck and fix-auto Read sub-skill files that open with the stop line. While the module is
// loaded, their main-loop Read gets a note that the line does not apply; with no module there is
// no note and the run stops. The hook refuses nothing: a fault means no note, which stops the run.
export function registerReadNote(on: On): void {
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const r = await next(e)
    if (e.tool !== 'Read' || e.agentId !== undefined) return r
    if (r.deny !== undefined || r.isError === true) return r
    const path = String(e.file_path)
    if (!/[\\/]SKILL\.md$/.test(path)) return r
    const root = (await $.fs.stat($.plugin.root, { resolve: true })).realPath
    const real = (await $.fs.stat(path, { resolve: true })).realPath
    if (root === undefined || real === undefined) return r
    const name = skillName(root, real)
    if (name === null || !STOP_SKILLS.includes(name)) return r
    return { ...r, context: [...(r.context ?? []), SKIP_NOTE] }
  }).catch(($, e, next) => next(e))
}

// The skill a resolved path names when it is <root>/skills/<name>/SKILL.md, else null.
function skillName(root: string, real: string): string | null {
  if (!real.startsWith(root)) return null
  const m = /^[\\/]skills[\\/]([^\\/]+)[\\/]SKILL\.md$/.exec(real.slice(root.length))
  return m?.[1] ?? null
}
```

`hooks/register.ts`:

```ts
import type { Register } from 'claude-code'
import { registerSkillPrompt } from './skill-prompt'
import { registerReadNote } from './read-note'

export const register: Register = on => {
  registerSkillPrompt(on)
  registerReadNote(on)
}
```

§12: `MIN_TESTS=15`.

- [ ] **Step 4: Run tests and gates**

Run: `claude plugin test . && claude plugin validate . && bash scripts/check-contract.sh`
Expected: 15 pass; validate lists `gating hook with .catch: tool.call{tool=Read}`; `check-contract: OK`.

- [ ] **Step 5: Commit**

```bash
git add hooks/ scripts/check-contract.sh
git commit -m "feat(hooks): note on Read of a stop-line skill file, main loop only"
```

---

### Task 6: Record megamaid's dispatches with role and lane

**Files:**
- Create: `hooks/agents.ts`, `hooks/agents.test.ts`
- Modify: `hooks/run.ts` (`parseBrief`, `addAgent`), `hooks/register.ts`, `scripts/check-contract.sh` (`MIN_TESTS=25`)

**Interfaces:**
- Consumes: `startRun` (Task 3), `rig`, `spawnInput`, `briefPath`, `MEGAMAID`, `FOREIGN` (Task 1).
- Produces: `registerAgents(on: On): void`; from `hooks/run.ts`: `type Brief = { runStem: string; lane: string; role: string }`, `parseBrief(prompt: string): Brief | null`, `addAgent(run: MegamaidRun, agentId: string, agent: MegamaidAgent): MegamaidRun`.

- [ ] **Step 1: Write the failing tests**

`hooks/agents.test.ts`:

```ts
import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import { parseBrief } from './run'
import { FOREIGN, briefPath, rig, spawnInput } from './test-rig'

const STEM = 'review-1760000000-ab12'
const FIX_STEM = 'fix-1760000100-cd34'
const say = (path: string) => 'Read these first, in order: /p/shared/x.md, ' + path

function answerSkills(on: On) { on('skill.prompt', () => ({ text: 'body' })) }
function answerSpawns(on: On, id: () => string | undefined) { on('agent.spawn', () => ({ model: 'haiku', agentId: id() })) }

test('a spawn with a brief is recorded with role, lane and stem', async ($, on) => {
  const { writes, logs } = rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  expect(writes.at(-1)).toMatchObject({ skill: 'megamaid:review', agents: { a1: {
    subagentType: 'megamaid:code-reviewer', provider: 'megamaid@inline', role: 'code-reviewer', lane: 'review', runStem: STEM } } })
  expect(logs).toContain('review/code-reviewer spawned as megamaid:code-reviewer (a1)')
})

test('lanes tell apart one role name in several jobs', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.skill.prompt({ skill: 'megamaid:vacu-suck', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(FIX_STEM, 'fix', 'code-reviewer')) }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer', prompt: say(briefPath(FIX_STEM, 'fix', 'implementer')) }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer', prompt: say(briefPath(FIX_STEM, 'plan', 'implementer')) }))
  const agents = writes.at(-1)?.agents ?? {}
  expect([agents.a1?.lane, agents.a2?.lane, agents.a3?.lane, agents.a4?.lane]).toEqual(['review', 'fix', 'fix', 'plan'])
  expect(agents.a4).toMatchObject({ role: 'implementer', runStem: FIX_STEM })
})

test('a megamaid-provider spawn without a brief counts only during a patterns run', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:code-reviewer' }))
  expect(Object.keys(writes.at(-1)?.agents ?? {})).toEqual([])
  await $.skill.prompt({ skill: 'megamaid:patterns', text: 'x' })
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:pattern-scanner' }))
  expect(writes.at(-1)?.agents).toMatchObject({ a2: { role: 'unknown', lane: null, runStem: null } })
})

test('a provider spelled without @ is still megamaid during a patterns run', async ($, on) => {
  const { writes } = rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  await $.skill.prompt({ skill: 'megamaid:patterns', text: 'x' })
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:pattern-shaver', provider: { plugin: 'megamaid', tier: 'user' } }))
  expect(writes.at(-1)?.agents).toMatchObject({ a1: { role: 'unknown' } })
})

test('a foreign spawn without a brief is ignored (control: with a brief it is recorded)', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.skill.prompt({ skill: 'megamaid:patterns', text: 'x' })
  await $.agent.spawn(spawnInput({ provider: FOREIGN, subagentType: 'Explore' }))
  expect(writes).toHaveLength(1)
  await $.agent.spawn(spawnInput({ provider: FOREIGN, subagentType: 'general-purpose', prompt: say(briefPath(STEM, 'plan', 'implementer')) }))
  expect(Object.keys(writes.at(-1)?.agents ?? {})).toEqual(['a2'])
})

test("a subagent's spawn is ignored (control: the main loop's is recorded)", async ($, on) => {
  const { writes } = rig(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'simplifier')), parentAgentId: 'p1' }))
  expect(writes).toHaveLength(0)
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'simplifier')) }))
  expect(writes).toHaveLength(1)
})

test('a result without agentId records nothing (control: with one it records)', async ($, on) => {
  const { writes } = rig(on)
  let id: string | undefined
  answerSpawns(on, () => id)
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'simplifier')) }))
  expect(writes).toHaveLength(0)
  id = 'a9'
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'simplifier')) }))
  expect(writes).toHaveLength(1)
})

test('a brief spawn with no stored run starts a "none" run', async ($, on) => {
  const { writes } = rig(on); answerSpawns(on, () => 'a1')
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'test-auditor')) }))
  expect(writes.at(-1)).toMatchObject({ skill: 'none', agents: { a1: { role: 'test-auditor', lane: 'review' } } })
})

test('five spawns raised at once all land', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  // Hold the first five reads until all five arrived, so every writer starts from the same version.
  let armed = false
  let held = 0
  let release: () => void = () => {}
  const gate = new Promise<void>(r => { release = r })
  on('state.get', async (_$, e, next) => {
    const r = await next(e)
    if (armed && held < 5) { held++; if (held === 5) release(); await gate }
    return r
  })
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  armed = true
  await Promise.all([1, 2, 3, 4, 5].map(i =>
    $.agent.spawn(spawnInput({ tool_use_id: 't' + i, prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))))
  expect(held).toBe(5)
  expect(Object.keys(writes.at(-1)?.agents ?? {}).sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
})

test('parseBrief: free-form role names and backslash paths', () => {
  expect(parseBrief(say(briefPath(STEM, 'review', 'My.Role_2')))).toEqual({ runStem: STEM, lane: 'review', role: 'My.Role_2' })
  expect(parseBrief('C:\\w\\.megamaid\\excerpts\\' + STEM + '.fix.implementer.brief.md')).toEqual({ runStem: STEM, lane: 'fix', role: 'implementer' })
  expect(parseBrief('no brief here')).toBeNull()
})
```

So the test file loads before `parseBrief` exists, append a stub to `hooks/run.ts` (Step 3 replaces it):

```ts
export function parseBrief(_prompt: string): { runStem: string; lane: string; role: string } | null { return null }
```

- [ ] **Step 2: Run to see them fail**

Run: `claude plugin test .`
Expected: the 10 new agent tests FAIL; 15 pass; `Ran 25 tests`.

- [ ] **Step 3: Implement**

Replace the stub in `hooks/run.ts` with the following (and change its import to `import type { MegamaidAgent, MegamaidRun } from '../types'`):

```ts
// A run brief: .megamaid/excerpts/<stem>.<lane>.<role>.brief.md, written by megamaid.py brief.
// <stem> is <skill>-<digits>-<hex4>; <lane> is the brief's skill (review, plan, fix); <role> is a
// config key, unrestricted, so it is whatever stands between <lane>. and .brief.md.
const BRIEF = /\.megamaid[\\/]excerpts[\\/]([a-z][a-z-]*-[0-9]+-[0-9a-f]{4})\.([a-z][a-z-]*)\.([^\s\\/]+?)\.brief\.md/

export type Brief = { runStem: string; lane: string; role: string }

export function parseBrief(prompt: string): Brief | null {
  const m = BRIEF.exec(prompt)
  if (m === null) return null
  const [, runStem, lane, role] = m
  if (runStem === undefined || lane === undefined || role === undefined) return null
  return { runStem, lane, role }
}

export function addAgent(run: MegamaidRun, agentId: string, agent: MegamaidAgent): MegamaidRun {
  return { ...run, agents: { ...run.agents, [agentId]: agent } }
}
```

`hooks/agents.ts`:

```ts
import { update } from 'claude-code'
import type { On } from 'claude-code'
import { addAgent, parseBrief, startRun } from './run'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// Records megamaid's own main-loop dispatches: a prompt that names a run brief, or (the briefless
// scanner and shaver) a megamaid-provided agent while the stored run is patterns. The stored run is
// the last run, not an active one, so nothing else is attributed to it. The hook refuses nothing.
export function registerAgents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (e.parentAgentId !== undefined || r.agentId === undefined) return r
    const agentId = r.agentId
    const brief = parseBrief(e.prompt)
    if (brief === null) {
      if (e.provider.plugin.split('@')[0] !== 'megamaid') return r
      const { value: stored } = await $.state.get(RUN)
      if (stored?.skill !== 'megamaid:patterns') return r
    }
    const now = await $.clock.now()
    const fresh = crypto.randomUUID()
    await update($, RUN, run => addAgent(run ?? startRun(fresh, 'none', now), agentId, {
      subagentType: e.subagentType,
      provider: e.provider.plugin,
      role: brief?.role ?? 'unknown',
      lane: brief?.lane ?? null,
      runStem: brief?.runStem ?? null,
    }))
    $.ui.log(`${brief?.lane ?? '-'}/${brief?.role ?? 'unknown'} spawned as ${e.subagentType} (${agentId})`, { to: 'debug' })
    return r
  }).catch(($, e, next) => next(e))
}
```

`hooks/register.ts`: add `import { registerAgents } from './agents'` and call `registerAgents(on)` after `registerReadNote(on)`.

§12: `MIN_TESTS=25`.

- [ ] **Step 4: Run tests and gates**

Run: `claude plugin test . && claude plugin validate . && bash scripts/check-contract.sh`
Expected: 25 pass; validate lists `gating hook with .catch: agent.spawn`, `state writes: megamaid.run` and `state reads: megamaid.run`; `check-contract: OK`.

- [ ] **Step 5: Commit**

```bash
git add hooks/ scripts/check-contract.sh
git commit -m "feat(hooks): record megamaid's dispatches with role, lane and run stem"
```

---

### Task 7: Session start and end

**Files:**
- Create: `hooks/session.ts`, `hooks/session.test.ts`
- Modify: `hooks/register.ts`, `scripts/check-contract.sh` (`MIN_TESTS=27`; one-`RUN` check)

**Interfaces:**
- Consumes: `rig`, `endInput` (Task 1).
- Produces: `registerSession(on: On): void`.

- [ ] **Step 1: Write the failing tests and the `RUN` check**

`hooks/session.test.ts`:

```ts
import { test, expect } from 'claude-code/testing'
import { endInput, rig } from './test-rig'

test('session.start logs that the module loaded, with the Claude Code version', async ($, on) => {
  const { logs } = rig(on)
  on('session.version', () => ({ value: { version: '2.1.296', base: '2.1.296', builtAt: '2026-10-09T01:31:52Z' } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false })
  expect(logs).toContain('module loaded (Claude Code 2.1.296)')
})

test('session.end writes null (control: a skill wrote a run first)', async ($, on) => {
  const { writes } = rig(on)
  on('skill.prompt', () => ({ text: 'body' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  expect(writes).toHaveLength(1)
  await $.session.end(endInput())
  expect(writes).toHaveLength(2)
  expect(writes[1]).toBeNull()
})
```

In §12 of `scripts/check-contract.sh`, before `MIN_TESTS`, add:

```bash
# The state ref is a literal const in each file that uses it (validate reads no imported ref); the copies must agree.
runs=$(grep -h '^const RUN = ' hooks/*.ts | sort -u)
[ "$runs" = "const RUN = { plugin: 'megamaid', key: 'run' } as const" ] || { echo "FAIL: hooks/*.ts declare RUN differently: $runs"; fail=1; }
have=$(grep -l '^const RUN = ' hooks/*.ts | sort | tr '\n' ' ')
[ "$have" = "hooks/agents.ts hooks/session.ts hooks/skill-prompt.ts " ] || { echo "FAIL: want RUN in exactly hooks/agents.ts, hooks/session.ts, hooks/skill-prompt.ts; found: $have"; fail=1; }
```

Run: `claude plugin test . ; bash scripts/check-contract.sh`
Expected: both session tests FAIL (the start test with `Received: []`); check-contract FAILs `want RUN in exactly hooks/agents.ts, hooks/session.ts, hooks/skill-prompt.ts`. (Tasks 3 and 6 added two of the copies before this check existed; it covers them from here on.)

- [ ] **Step 2: Implement**

`hooks/session.ts`:

```ts
import { update } from 'claude-code'
import type { On } from 'claude-code'

const RUN = { plugin: 'megamaid', key: 'run' } as const

export function registerSession(on: On): void {
  // smoke.sh reads this line to know the module loaded.
  on('session.start', async ($, e, next) => {
    const { version } = await $.session.version()
    $.ui.log(`module loaded (Claude Code ${version})`, { to: 'debug' })
    return next(e)
  })
  // /clear ends the conversation too; the next skill starts a fresh run.
  on('session.end', async ($, e, next) => {
    await update($, RUN, () => null)
    return next(e)
  }).catch(($, e, next) => next(e))
}
```

`hooks/register.ts`, final form:

```ts
import type { Register } from 'claude-code'
import { registerSkillPrompt } from './skill-prompt'
import { registerReadNote } from './read-note'
import { registerAgents } from './agents'
import { registerSession } from './session'

export const register: Register = on => {
  registerSkillPrompt(on)
  registerReadNote(on)
  registerAgents(on)
  registerSession(on)
}
```

§12: `MIN_TESTS=27`.

- [ ] **Step 3: Run tests and gates**

Run: `claude plugin test . && claude plugin validate . && bash scripts/check-contract.sh`
Expected: 27 pass; `check-contract: OK`.

- [ ] **Step 4: Commit**

```bash
git add hooks/ scripts/check-contract.sh
git commit -m "feat(hooks): log module load at session start, clear the run at session end"
```

---

### Task 8: help Requirements and the smoke checks

**Files:**
- Modify: `skills/help/SKILL.md` (Overview), `scripts/smoke.sh`

**Interfaces:**
- Consumes: `TOKEN_LINE` line in `hooks/stop-line.ts`; the `module loaded (Claude Code …)` debug line (Task 7).

- [ ] **Step 1: Write the smoke checks first**

Replace `scripts/smoke.sh` with:

```bash
#!/usr/bin/env bash
# Run once before a PR: the free gates, then three short claude -p runs (about 0.25 USD):
# help with the module on (and proof it loaded), and review with the module off (it must stop).
# The behavioural gate is `claude plugin eval` (see evals/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== structural gates =="
claude plugin validate .
bash scripts/check-contract.sh

if claude plugin list --json 2>/dev/null | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
rows = d if isinstance(d, list) else d.get("plugins", [])
sys.exit(0 if any(str(r.get("id", "")).startswith("megamaid@") and r.get("enabled") for r in rows) else 1)'; then
  echo "WARN: an installed megamaid is enabled; it can load ahead of --plugin-dir . and be what this smoke tests."
fi

tmp="$(mktemp -d "${TMPDIR:-/tmp}/megamaid-smoke.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

not_loaded() {  # $1: stderr file. True when the engine said megamaid's module did not load.
  grep -i 'megamaid' "$1" | grep -i 'not loaded' >/dev/null  # no -q: an early exit can SIGPIPE the first grep under pipefail
}

echo "== help, module on =="
for args in "" "fix"; do
  dbg="$tmp/dbg-${args:-overview}"
  out="$(claude -p "/megamaid:help $args" --plugin-dir . --allowedTools "Skill Read" --debug-file "$dbg" 2>"$tmp/err")" || {
    echo "$out"; cat "$tmp/err"; echo "FAIL: /megamaid:help $args run errored"; exit 1
  }
  if not_loaded "$tmp/err"; then cat "$tmp/err"; echo "FAIL: megamaid's hooks module did not load"; exit 1; fi
  grep -q 'module loaded (Claude Code ' "$dbg" || { echo "FAIL: the debug log has no 'module loaded' line from megamaid"; exit 1; }
  if [ -z "$args" ]; then
    echo "$out" | grep -q "megamaid — code-review pipeline" || { echo "$out"; echo "FAIL: /megamaid:help did not print the overview"; exit 1; }
    echo "$out" | grep -q "MEGAMAID-MODULE-NOT-LOADED" || { echo "$out"; echo "FAIL: the overview has no Requirements block naming the token"; exit 1; }
  else
    echo "$out" | grep -q "Reviewer specialty is matched to the plan" || { echo "$out"; echo "FAIL: /megamaid:help fix did not print the per-command detail"; exit 1; }
  fi
done

echo "== review, module off (must stop) =="
TOKEN_LINE="$(sed -n "s/^export const TOKEN_LINE = '\(.*\)'$/\1/p" hooks/stop-line.ts)"
[ -n "$TOKEN_LINE" ] || { echo "FAIL: no TOKEN_LINE in hooks/stop-line.ts"; exit 1; }
out="$(claude -p "/megamaid:review" --plugin-dir . --settings '{"disableAllHooks":true}' \
  --disallowedTools Agent Bash Write Edit --max-budget-usd 0.3 < /dev/null 2>"$tmp/err")" || true
not_loaded "$tmp/err" || { cat "$tmp/err"; echo "FAIL: precondition: the engine did not report megamaid's module as not loaded"; exit 1; }
last="$(printf '%s\n' "$out" | awk 'NF {l = $0} END {print l}' | tr -d '`')"
[ "$last" = "$TOKEN_LINE" ] || { echo "$out"; echo "FAIL: with the module off, review did not stop on: $TOKEN_LINE"; exit 1; }

echo "smoke: OK (gates, help with the module on, review stops with it off)."
echo "For a full behavioral pass, run the eval suite (see evals/README.md)."
```

- [ ] **Step 2: See it fail (a few cents)**

Say the cost (help runs only, a few cents; the module-off run is not reached), then run: `bash scripts/smoke.sh`
Expected: `FAIL: the overview has no Requirements block naming the token`.

- [ ] **Step 3: Add Requirements to the help Overview**

In `skills/help/SKILL.md`, inside the Overview code block, insert after the `/megamaid:help` command entry and before `Focus brief`:

```
Requirements

  megamaid needs a Claude Code build with hooks modules, and its hooks
  module loaded. If a command replies MEGAMAID-MODULE-NOT-LOADED, the
  module did not load:

    Claude Code without hooks modules   update Claude Code (an old build
                                        may refuse the plugin outright)
    disableAllHooks in settings         remove it or set it to false
    "hooks modules are turned off …     start claude once with network
     rollout switch"                    access; if it stays, hooks
                                        modules are off for your account
    anything else                       run claude --debug-file <file>
                                        and read the line naming megamaid
```

Keep the block's indentation and blank lines consistent with its neighbours.

- [ ] **Step 4: Run smoke (about 0.25 USD)**

Say the cost, then run: `bash scripts/smoke.sh`
Expected: `smoke: OK (…)`. If the module-off run does not stop on the token, stop and report: that would contradict the spike evidence.

- [ ] **Step 5: Commit**

```bash
git add skills/help/SKILL.md scripts/smoke.sh
git commit -m "feat(help,smoke): Requirements in help; smoke proves the module loads and that review stops without it"
```

---

### Task 9: The not-loaded grader in every eval case but help

**Files:**
- Create: `evals/{config-null-delete,dispatch-delivery,fix-auto-off,fix-auto-on,fix-reviewer-diff-scope,manifest-slice,noncode-shortcircuit}/graders/module-loaded.md`
- Modify: `scripts/check-contract.sh` (§11 gains the grader check), `evals/README.md`

- [ ] **Step 1: Add the check (fails first)**

Add after §11's closing `fi` (so it runs even when `STOP_LINE` extraction fails):

```bash
# Every eval case but help-overview fails when its run stopped on the token (a module that did not
# load would otherwise pass every negative grader). help is exempt: its Requirements block names it.
for d in evals/*/; do
  c=$(basename "$d"); [ -d "$d/graders" ] || continue; [ "$c" = help-overview ] && continue
  g="$d/graders/module-loaded.md"
  if [ ! -f "$g" ] || ! grep -qx 'pattern: "MEGAMAID-MODULE-NOT-LOADED"' "$g" || ! grep -qx 'match: not_contains' "$g"; then
    echo "FAIL: $g missing or not a not_contains grader for MEGAMAID-MODULE-NOT-LOADED"; fail=1
  fi
done
```

Run: `bash scripts/check-contract.sh` → seven `module-loaded.md missing` FAILs.

- [ ] **Step 2: Add the graders**

```bash
for c in config-null-delete dispatch-delivery fix-auto-off fix-auto-on fix-reviewer-diff-scope manifest-slice noncode-shortcircuit; do
  printf -- '---\ntype: regex\npattern: "MEGAMAID-MODULE-NOT-LOADED"\ntarget: last_message\nmatch: not_contains\n---\n' > "evals/$c/graders/module-loaded.md"
done
```

- [ ] **Step 3: Replay script still passes; the new grader is read**

Run: `bash scripts/test-replay.sh` → passes (it does not read the new graders). Then, if an eval run's kept temp dir is on this machine, run `python3 -I scripts/replay-graders.py evals/fix-auto-on <kept dir>` and expect `✓ module-loaded: pattern absent as expected`; if none is kept, skip this half and say so in the commit message.

- [ ] **Step 4: evals/README**

In `evals/README.md`:
- replace "`scripts/smoke.sh` remains the offline structural gate." with "`scripts/smoke.sh` runs the free gates plus three short `claude -p` runs (about 0.25 USD); it is not offline."
- add to the Status list: "- **Module loaded.** Every case but `help-overview` carries `module-loaded.md`, a `not_contains` grader for `MEGAMAID-MODULE-NOT-LOADED`, so a run whose hooks module did not load fails instead of passing its negative graders."

- [ ] **Step 5: Gates and commit**

Run: `claude plugin validate . && bash scripts/check-contract.sh` → `check-contract: OK`

```bash
git add evals/ scripts/check-contract.sh
git commit -m "test(evals): every case but help fails when the hooks module did not load"
```

---

### Task 10: Docs that state the new facts

**Files:**
- Modify: `README.md`, `PLAYBOOK.md`, `docs/handover/plan.md` (not tracked; edit only)

- [ ] **Step 1: README**

- Line 7: replace "From Phase 1 megamaid moves comb's rules into a hooks module and will require a mod-capable Claude Code; comb stays for builds without mods." with "megamaid moves comb's rules into a hooks module and requires a Claude Code build with hooks modules, with the module loaded; comb stays for builds without them."
- `## Requirements`: add first: "- Claude Code with hooks modules (tested on 2.1.296, the version in `vendor/claude-code-types/`), with megamaid's hooks module loaded. A command that replies `MEGAMAID-MODULE-NOT-LOADED` means it did not load; `/megamaid:help` lists the causes." Keep the effort line as an extra condition: "- Claude Code 2.1.292 or later, only if you configure an `effort` value."
- Development section: list the gates as `claude plugin validate .` and `scripts/check-contract.sh` (which runs `tsc` and `claude plugin test`); the types refresh (`claude --plugin-dir .` once, `scripts/sync-types.sh`, commit `chore(types): Claude Code X`); smoke's three runs and cost.

- [ ] **Step 2: PLAYBOOK**

- "Where things live": replace the `hooks/` line with "`hooks/`: the hooks module, the code half of the runtime contract. `register.ts` wires one file per event (`skill-prompt.ts`, `read-note.ts`, `agents.ts`, `session.ts`); pure helpers without `$` live in `run.ts` and `stop-line.ts`, the stop line's single source; tests are `*.test.ts` with `test-rig.ts`. `types/` holds the `$.state` contract. `vendor/claude-code-types/` is the pinned engine API, refreshed by `scripts/sync-types.sh`."
- "Design rules", after "Single source": "- **The stop line is the one copied text.** It must be in the file the engine loads, so each skill but help carries it; `check-contract.sh` keeps every copy equal to `hooks/stop-line.ts`."
- "Design rules", after "Guards fail closed": "- **Observers refuse nothing.** A hook that only records, at a site that can refuse (`agent.spawn`, `tool.call`), takes a pass-through `.catch(($, e, next) => next(e))`; validate still lists it as gating."
- "Release gate" step 3: "Covered by step 2: `check-contract.sh` runs `tsc` and `claude plugin test`."
- The smoke sentence: "`scripts/smoke.sh` runs once before a PR: the free gates, help with the module on (and proof it loaded), and review with it off, which must stop (about 0.25 USD)."

- [ ] **Step 3: plan.md**

In `docs/handover/plan.md` Phase 1: replace everything from "Add `hooks/hooks.json`, `hooks/register.tsx`, …" through the "Done when: a no-op module loads…" line with: "A hooks module (`hooks/register.ts`) that strips each skill's stop line, so a session without the module stops, and records runs and megamaid's dispatches with role and lane. Spike questions answered: `docs/superpowers/specs/2026-10-12-phase1-spike-findings.md`. Spec: `docs/superpowers/specs/2026-10-13-megamaid-mod-skeleton-design.md`.\nDone when: the free gates pass with `tsc` and `claude plugin test`, locally and in CI; smoke passes (module on and off); one real `/megamaid:review` shows run detection; the full eval suite has run once with the not-loaded grader and is compared with comb v0.15.0." Phase 2: add "A background agent's completion raises an extra main-loop `turn.complete`; define run end; key usage on (lane, role)." Phase 4: add "The fix gate is feasible: a hook can deny the Skill tool call once `fix` drops `disable-model-invocation`."

- [ ] **Step 4: Gates and commit**

Run: `claude plugin validate . && bash scripts/check-contract.sh` → `check-contract: OK`

```bash
git add README.md PLAYBOOK.md
git commit -m "docs: hooks-module requirement, gates, types refresh and the stop-line rules"
```

---

## After the tasks

Per PLAYBOOK "The loop", steps 5–7. Each paid step: say the cost first.

1. **Live check (about 0.5–1 USD; record the local Claude Code version with the result).** In a scratch git repo with a one-line uncommitted change: `claude -p "/megamaid:review" --plugin-dir <this repo> --debug-file <f>`. Pass when `<f>` has `run megamaid:review started` and one `review/<role> spawned as …` line per reviewer, and each logged agentId equals an `agentId` in the Agent tool results of the session's transcript JSONL (`~/.claude/projects/<scratch path>/<session id>.jsonl`). Record in the ledger.
2. **Branch review.** Two independent reviewers on the strongest available model, contract lens and code-and-tests lens, briefed with the files (spec, this plan, the branch diff), not conclusions. Fix Critical and Important findings, each proven by a check that failed first; fix Minor or record it as deferred.
3. **Gate.** `claude plugin validate .`, `scripts/check-contract.sh`, `scripts/smoke.sh` (about 0.25 USD), and the full eval suite once (about 5 USD; macOS: Homebrew git first on `PATH`, `--keep-temp`). Compare per case and on cost with comb v0.15.0 (`~/Development/comb-the-desert-claude-skill/evals/results/2026-10-12T01-29-43-961Z`, 6/8, 4.64 USD, its two misses re-read with `scripts/replay-graders.py`). A case that passed there and fails here is read from its kept trace first. If the module did not load in the eval run (every case fails `module-loaded`), report it; do not fix the runner. Report both Claude Code versions (local and the CI pin).
4. **Release.** CHANGELOG `## [0.2.0] — <date>`: Added — the hooks module; the stop line in every working skill, so a session without the module stops instead of running unguarded; run detection with role and lane. Changed — megamaid requires a Claude Code build with hooks modules (breaking for builds without them); help gains Requirements. Then `version` 0.2.0 in `.claude-plugin/plugin.json` and the README Status line, together; commit `docs(release): v0.2.0 — hooks module skeleton`. Push on the maintainer's go; mark the draft PR from Task 2 ready (`gh pr ready`) and update its body (signed "On behalf of @olioskar by Claude").
5. **CI on the finished branch.** `gh pr checks --watch`: the `contract` job passes with at least 27 tests (`Ran 27 tests` or more in its log). Record the result in the ledger. The maintainer merges.

## Deviations from the spec (recorded here, and in the ledger when executed)

- `$.ui.log` returns `void` (types line 2420), so the spec's "a log call inside the `catch` is written `.catch(() => {})`" does not apply: a void call cannot reject. It could still throw synchronously; that is harmless, because the stripping `.catch` on the `skill.prompt` registration strips anyway.
- The spec's "a test asserts the three `RUN` consts are equal" is a check-contract grep (Task 7) naming the three files: the consts are file-local, and exporting them only for a test adds surface. Tasks 3 and 6 add copies before the check exists.
- `stripStopLine` also tolerates a trailing `\r` (Review Focus 1), beyond the spec's `.gitattributes`.
- The CI dry run is Task 2, not the first task; it still runs before any module code.
- Added, not named in the spec: `scripts/test-sync-types.sh` and its §5 wiring (PLAYBOOK: a script changes with its fixtures); the eval-grader check in check-contract §11; smoke's check that the help overview names the token; a pass-through `.catch` on `session.end` (not a gating site; harmless); the `isRunSkill` helper in `run.ts`; smoke drops its last line ("Or drive /megamaid:review manually…").
- A briefless agent's log line renders the missing lane as `-`: `-/unknown spawned as <type> (<id>)`.
- Untested path: removing the stripping `.catch` still passes all 27 tests; its only remaining trigger, a budget overrun, cannot be simulated in the kit.
