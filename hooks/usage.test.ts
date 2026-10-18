import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import { briefPath, rig, spawnInput, turnInput } from './test-rig'

const STEM = 'review-1760000000-ab12'
const say = (path: string) => 'Read these first, in order: /p/shared/x.md, ' + path
const LEDGER_PLAN = '.megamaid/usage/plan-1000.md'

function answerSkills(on: On) { on('skill.prompt', () => ({ text: 'body' })) }
function answerSpawns(on: On, id: () => string | undefined) { on('agent.spawn', () => ({ model: 'haiku', agentId: id() })) }

test('a main-loop turn during a run adds to the orchestrator (control: with no stored run nothing is written)', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  await $.turn.complete(turnInput())
  expect(writes).toHaveLength(0)
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  expect(writes).toHaveLength(1)
  await $.turn.complete(turnInput())
  expect(writes).toHaveLength(2)
  expect(writes.at(-1)).toMatchObject({ skill: 'megamaid:plan', lastTurnAt: 1000,
    usage: { turns: 1, input: 100, cacheRead: 1000, cacheWrite: 10, output: 50, model: 'claude-opus-5-5' } })
})

test("a recorded agent's turn adds to that agent, two turns sum (control: an unrecorded agentId adds nothing)", async ($, on) => {
  const { writes, logs } = rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  const before = writes.length
  await $.turn.complete(turnInput({ agentId: 'zz' }))
  expect(writes).toHaveLength(before)
  await $.turn.complete(turnInput({ agentId: 'a1' }))
  await $.turn.complete(turnInput({ agentId: 'a1', usage: { input_tokens: 1, cache_read_input_tokens: 2, cache_creation_input_tokens: 3, output_tokens: 4, model: 'claude-sonnet-5' } }))
  expect(writes).toHaveLength(before + 2)
  expect(writes.at(-1)?.agents.a1?.usage).toEqual({ turns: 2, input: 101, cacheRead: 1002, cacheWrite: 13, output: 54, model: 'claude-sonnet-5' })
  expect(writes.at(-1)?.usage.turns).toBe(0)
  expect(logs).toContain('usage review/code-reviewer +1110/50 (1)')
  expect(logs).toContain('usage review/code-reviewer +6/4 (2)')
})

test('an agent recorded in an earlier run counts nowhere once a new run started (control: a main-loop turn still counts)', async ($, on) => {
  const { writes } = rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  const before = writes.length
  await $.turn.complete(turnInput({ agentId: 'a1' }))
  expect(writes).toHaveLength(before)
  await $.turn.complete(turnInput())
  expect(writes).toHaveLength(before + 1)
  expect(writes.at(-1)).toMatchObject({ skill: 'megamaid:plan', usage: { turns: 1 } })
})

test('a turn without usage writes no state (control: with usage it does)', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  await $.turn.complete(turnInput({ usage: undefined, reason: 'aborted', isAborted: true }))
  expect(writes).toHaveLength(1)
  await $.turn.complete(turnInput())
  expect(writes).toHaveLength(2)
})

test('a plan run writes .megamaid/usage/plan-<startedAt>.md after a main-loop turn, and the .gitignore first when missing (control: when it exists, no second write)', async ($, on) => {
  const r = rig(on); answerSkills(on)
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  expect(r.fsWrites).toHaveLength(0)
  await $.turn.complete(turnInput())
  expect(r.fsWrites.map(w => w[0])).toEqual(['.megamaid/.gitignore', LEDGER_PLAN])
  expect(r.files['.megamaid/.gitignore']).toBe('*\n')
  expect(r.files[LEDGER_PLAN]).toContain('| orchestrator | - | 1 | 100 | 1000 | 10 | 50 | claude-opus-5-5 |')
  expect(r.logs.filter(l => l.startsWith('ledger '))).toEqual([`ledger ${LEDGER_PLAN}`])
  r.exists.add('.megamaid/.gitignore')
  await $.turn.complete(turnInput())
  expect(r.fsWrites.map(w => w[0])).toEqual(['.megamaid/.gitignore', LEDGER_PLAN, LEDGER_PLAN])
  expect(r.files[LEDGER_PLAN]).toContain('| orchestrator | - | 2 | 200 | 2000 | 20 | 100 | claude-opus-5-5 |')
  expect(r.logs.filter(l => l.startsWith('ledger '))).toEqual([`ledger ${LEDGER_PLAN}`, `ledger ${LEDGER_PLAN}`])
})

test('the cost line is the session cost now minus at start', async ($, on) => {
  const r = rig(on); answerSkills(on)
  r.cost = 1
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  expect(r.writes.at(-1)?.costAtStart).toBe(1)
  r.cost = 3.5
  await $.turn.complete(turnInput())
  expect(r.files[LEDGER_PLAN]).toContain('Cost: 2.50 USD')
})

test('with no session.usage answer the run still starts (costAtStart null) and the cost line says unavailable', async ($, on) => {
  const r = rig(on, { usage: false }); answerSkills(on)
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  expect(r.writes).toHaveLength(1)
  expect(r.writes.at(-1)?.costAtStart).toBeNull()
  await $.turn.complete(turnInput())
  expect(r.files[LEDGER_PLAN]).toContain('Cost: unavailable')
})

test('a denied fs.write leaves the state write standing and logs ledger failed', async ($, on) => {
  const r = rig(on); answerSkills(on)
  r.failWrites = true
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  await $.turn.complete(turnInput())
  expect(r.writes).toHaveLength(2)
  expect(r.writes.at(-1)?.usage.turns).toBe(1)
  expect(r.logs.some(l => l.startsWith('ledger failed: '))).toBe(true)
  expect(r.logs.some(l => l.startsWith('ledger .megamaid'))).toBe(false)
})

test('a failing fs.exists leaves the state write standing, writes no file and logs ledger failed', async ($, on) => {
  const r = rig(on); answerSkills(on)
  r.failExists = true
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  await $.turn.complete(turnInput())
  expect(r.writes.at(-1)?.usage.turns).toBe(1)
  expect(r.fsWrites).toHaveLength(0)
  expect(r.logs.some(l => l.startsWith('ledger failed: '))).toBe(true)
})

const REPORT = '/w/docs/megamaid/reviews/branch-x-round1-report.md'
const LEDGER = '/w/docs/megamaid/reviews/branch-x-round1-usage.md'
type WriteAnswer = 'ok' | 'deny' | 'error'
function answerWrites(on: On, how: () => WriteAnswer = () => 'ok') {
  on('tool.call', { tool: 'Write' }, (_$, e) => {
    const h = how()
    if (h === 'deny') return { deny: 'no' }
    if (h === 'error') return { isError: true as const, result: 'boom', text: 'boom' }
    return { result: { type: 'create' as const, filePath: String(e.file_path), content: String(e.content), structuredPatch: [], originalFile: null } }
  })
}

test("a review run writes no file before its report; the main loop's first report Write places the ledger beside it and later ones leave it (controls: a non-report name, a subagent's Write, a denied and an errored Write set none)", async ($, on) => {
  const r = rig(on); answerSkills(on)
  let how: WriteAnswer = 'ok'; answerWrites(on, () => how)
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.turn.complete(turnInput())
  expect(r.fsWrites).toHaveLength(0)
  expect(r.writes.at(-1)?.report).toBeNull()
  await $.tool.call({ tool: 'Write', file_path: '/w/docs/megamaid/reviews/notes.md', content: 'n' })
  const sub = { tool: 'Write' as const, file_path: REPORT, content: 'r', agentId: 'a1' }
  await $.tool.call(sub)
  how = 'deny'
  expect(await $.tool.call({ tool: 'Write', file_path: REPORT, content: 'r' })).toEqual({ deny: 'no' })
  how = 'error'
  await $.tool.call({ tool: 'Write', file_path: REPORT, content: 'r' })
  expect(r.writes.at(-1)?.report).toBeNull()
  expect(r.fsWrites).toHaveLength(0)
  how = 'ok'
  await $.tool.call({ tool: 'Write', file_path: REPORT, content: 'r' })
  expect(r.writes.at(-1)?.report).toBe(REPORT)
  expect(r.fsWrites.map(w => w[0])).toEqual([LEDGER])
  expect(r.files[LEDGER]).toContain('| orchestrator | - | 1 |')
  await $.turn.complete(turnInput())
  expect(r.fsWrites.map(w => w[0])).toEqual([LEDGER, LEDGER])
  expect(r.files[LEDGER]).toContain('| orchestrator | - | 2 |')
  // A sweep's second round writes a round-2 report in the same run: the ledger stays with round 1.
  await $.tool.call({ tool: 'Write', file_path: '/w/docs/megamaid/reviews/branch-x-round2-report.md', content: 'r' })
  expect(r.writes.at(-1)?.report).toBe(REPORT)
  expect(r.fsWrites.map(w => w[0])).toEqual([LEDGER, LEDGER])
  expect(r.logs.filter(l => l.startsWith('ledger '))).toEqual([`ledger ${LEDGER}`, `ledger ${LEDGER}`])
})

test('a report Write outside a review or sweep run sets no report (control: in a sweep it does)', async ($, on) => {
  const r = rig(on); answerSkills(on); answerWrites(on)
  await $.skill.prompt({ skill: 'megamaid:plan', text: 'x' })
  await $.tool.call({ tool: 'Write', file_path: REPORT, content: 'r' })
  expect(r.writes.at(-1)?.report).toBeNull()
  await $.skill.prompt({ skill: 'megamaid:vacu-suck', text: 'x' })
  await $.tool.call({ tool: 'Write', file_path: '/w/docs/megamaid/reviews/pr-12-round2-report.md', content: 'r' })
  expect(r.writes.at(-1)?.report).toBe('/w/docs/megamaid/reviews/pr-12-round2-report.md')
  expect(r.fsWrites.map(w => w[0])).toEqual(['/w/docs/megamaid/reviews/pr-12-round2-usage.md'])
})

test('a backslash report path places the ledger beside it', async ($, on) => {
  const r = rig(on); answerSkills(on); answerWrites(on)
  await $.skill.prompt({ skill: 'megamaid:vacu-suck', text: 'x' })
  await $.tool.call({ tool: 'Write', file_path: 'C:\\w\\reviews\\pr-3-round1-report.md', content: 'r' })
  // The kit resolves a non-POSIX path against the plugin folder before the recorder sees it; the suffix is the hook's.
  expect(r.fsWrites.map(w => w[0].endsWith('C:\\w\\reviews\\pr-3-round1-usage.md'))).toEqual([true])
})

test("a nested agent's turn counts under the parent's key in the ledger", async ($, on) => {
  const r = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.skill.prompt({ skill: 'megamaid:fix', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  await $.agent.spawn(spawnInput({ subagentType: 'Explore', prompt: 'look', parentAgentId: 'a1' }))
  await $.turn.complete(turnInput({ agentId: 'a2' }))
  await $.turn.complete(turnInput({ agentId: 'a1' }))
  const text = r.files['.megamaid/usage/fix-1000.md'] ?? ''
  expect(text).toContain('| review/code-reviewer | 2 | 2 | 200 | 2000 | 20 | 100 | claude-opus-5-5 |')
  expect(text).toContain('| total | 2 | 2 | 200 | 2000 | 20 | 100 |  |')
  expect(text).toContain('Orchestrator share: 0% of input tokens, 0% of output tokens.')
})
