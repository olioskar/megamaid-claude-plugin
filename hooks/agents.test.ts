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
