import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import { parseBrief } from './run'
import { FOREIGN, briefPath, endInput, rig, spawnInput } from './test-rig'

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
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: say(briefPath(FIX_STEM, 'plan', 'planner')) }))
  const agents = writes.at(-1)?.agents ?? {}
  expect([agents.a1?.lane, agents.a2?.lane, agents.a3?.lane, agents.a4?.lane]).toEqual(['review', 'fix', 'fix', 'plan'])
  expect(agents.a4).toMatchObject({ role: 'planner', runStem: FIX_STEM })
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

test('a provider spelled without @ is still megamaid during a patterns run (control: megamaid-extras is not)', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.skill.prompt({ skill: 'megamaid:patterns', text: 'x' })
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:pattern-shaver', provider: { plugin: 'megamaid', tier: 'user' } }))
  expect(writes.at(-1)?.agents).toMatchObject({ a1: { role: 'unknown' } })
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid-extras:scanner', provider: { plugin: 'megamaid-extras@x', tier: 'user' } }))
  expect(Object.keys(writes.at(-1)?.agents ?? {})).toEqual(['a1'])
})

test('a foreign spawn without a brief is ignored (control: with a brief it is recorded)', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.skill.prompt({ skill: 'megamaid:patterns', text: 'x' })
  await $.agent.spawn(spawnInput({ provider: FOREIGN, subagentType: 'Explore' }))
  expect(writes).toHaveLength(1)
  await $.agent.spawn(spawnInput({ provider: FOREIGN, subagentType: 'general-purpose', prompt: say(briefPath(STEM, 'plan', 'planner')) }))
  expect(Object.keys(writes.at(-1)?.agents ?? {})).toEqual(['a2'])
})

test("a spawn nested in an unrecorded agent is ignored (controls: the main loop's is recorded; one nested in a recorded agent is recorded under it)", async ($, on) => {
  const { writes, logs } = rig(on)
  let n = 0; answerSpawns(on, () => 'a' + ++n)
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'simplifier')), parentAgentId: 'p1' }))
  expect(writes).toHaveLength(0)
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'simplifier')) }))
  expect(writes).toHaveLength(1)
  expect(writes.at(-1)?.agents.a2).toMatchObject({ parent: null, usage: null })
  await $.agent.spawn(spawnInput({ subagentType: 'Explore', provider: FOREIGN, prompt: 'look around', parentAgentId: 'a2' }))
  expect(writes).toHaveLength(2)
  expect(writes.at(-1)?.agents.a3).toEqual({
    subagentType: 'Explore', provider: 'other@market', role: 'simplifier', lane: 'review', runStem: STEM, parent: 'a2', seq: 1, usage: null })
  expect(logs).toContain('review/simplifier nested spawn Explore (a3) under a2')
  // A brief in a nested prompt does not re-key it: the parent's lane and role win.
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'fix', 'implementer')), parentAgentId: 'a3' }))
  expect(writes.at(-1)?.agents.a4).toMatchObject({ role: 'simplifier', lane: 'review', parent: 'a3' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'fix', 'implementer')), parentAgentId: 'nobody' }))
  expect(writes).toHaveLength(3)
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

test('a brief spawn after session end (stored null) starts a "none" run', async ($, on) => {
  const { writes } = rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.session.end(endInput())
  expect(writes.at(-1)).toBeNull()
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'test-auditor')) }))
  expect(writes.at(-1)).toMatchObject({ skill: 'none', agents: { a1: { role: 'test-auditor', lane: 'review' } } })
})

test('five spawns raised at once all land', async ($, on) => {
  const { writes } = rig(on); answerSkills(on)
  // Every spawn reaches next before any record is written; then the first five reads (the records'
  // updates, not the reads a briefed spawn makes before next) are held until all five arrived, so
  // every writer starts from the same version.
  let n = 0
  let releaseSpawns: () => void = () => {}
  const spawnGate = new Promise<void>(r => { releaseSpawns = r })
  on('agent.spawn', async () => {
    const id = 'a' + ++n
    if (n === 5) { armed = true; releaseSpawns() }
    await spawnGate
    return { model: 'haiku', agentId: id }
  })
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

const implPrompt = (lines: string) => lines + '\nRead these first, in order: /p/shared/fix-implementer-brief.md, ' + briefPath(FIX_STEM, 'fix', 'implementer')
const writeSetAnswer = (out: string) => (argv: readonly string[]) =>
  argv.includes('write-set') ? { exitCode: 0, stdout: out } : { exitCode: 2, stdout: '', stderr: 'megamaid.py: role x is not in agents' }

test('an implementer spawn stores its write-set', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1')
  r.process = writeSetAnswer('write-set: src/a.ts src/dir\n')
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer',
    prompt: implPrompt('Repository: /r\nItem: M1 — x\nInstruction file: /r/plans/M1-a.md\n') }))
  expect(r.writes.at(-1)?.agents.a1?.boundary).toEqual({ kind: 'write-set', root: '/r', paths: ['src/a.ts', 'src/dir'], note: null })
  const argv = r.argvs.find(a => a.includes('write-set')) ?? []
  expect(argv.slice(0, 2)).toEqual(['python3', '-I'])
  expect(String(argv[2]).endsWith('/scripts/megamaid.py')).toBe(true)
  expect(argv.slice(3)).toEqual(['write-set', '--file', '/r/plans/M1-a.md'])
})

test('an implementer spawn without an Instruction file line stores an empty write-set with a note', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1')
  r.process = writeSetAnswer('write-set: src/a.ts\n')
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer', prompt: implPrompt('Repository: /r\n') }))
  expect(r.writes.at(-1)?.agents.a1?.boundary).toMatchObject({ kind: 'write-set', paths: [], note: 'the prompt names no Instruction file or Repository line' })
})

test('a write-set exit 2 stores an empty write-set with the stderr line', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1')
  r.process = () => ({ exitCode: 2, stdout: '', stderr: 'megamaid.py: /r/plans/M1-a.md: No such file or directory\n' })
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer',
    prompt: implPrompt('Repository: /r\nInstruction file: /r/plans/M1-a.md\n') }))
  expect(r.writes.at(-1)?.agents.a1?.boundary).toEqual({ kind: 'write-set', root: '/r', paths: [], note: 'megamaid.py: /r/plans/M1-a.md: No such file or directory' })
})

test('a planner spawn stores its output file, a relative one joined on Repository', async ($, on) => {
  const r = rig(on); let n = 0; answerSpawns(on, () => 'p' + ++n)
  const plan = (lines: string) => lines + '\nRead these first, in order: /p/shared/plan-brief.md, ' + briefPath(STEM, 'plan', 'planner')
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: plan('Repository: /r\nOutput file: /r/plans/x/M1-a.md\n') }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: plan('Repository: /r\nOutput file: docs/plans/x/M2-b.md\n') }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: plan('Repository: /r\n') }))
  const agents = r.writes.at(-1)?.agents ?? {}
  expect(agents.p1?.boundary).toEqual({ kind: 'output-file', root: '/r', paths: ['/r/plans/x/M1-a.md'], note: null })
  expect(agents.p2?.boundary).toEqual({ kind: 'output-file', root: '/r', paths: ['/r/docs/plans/x/M2-b.md'], note: null })
  expect(agents.p3?.boundary).toMatchObject({ kind: 'output-file', paths: [], note: 'the prompt names no Output file line' })
})

test('a reviewer spawn stores no boundary', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1')
  await $.agent.spawn(spawnInput({ prompt: 'Repository: /r\n' + say(briefPath(FIX_STEM, 'fix', 'code-reviewer')) }))
  expect(r.writes.at(-1)?.agents.a1?.boundary).toBeNull()
})

const RESOLVE = (subagentType: string, model = 'opus') => `subagent_type: ${subagentType}\nmodel: ${model}\neffort: unset\nnative: yes\n`
const CONFIG = JSON.stringify({ agents: {
  implementer: { subagent_type: 'megamaid:implementer' }, planner: { subagent_type: 'megamaid:planner' }, 'x-planner': { subagent_type: 'megamaid:planner' } } })
function answerResolve(r: ReturnType<typeof rig>, subagentType: string, model = 'opus') {
  r.process = argv => argv.includes('resolve') ? { exitCode: 0, stdout: RESOLVE(subagentType, model) }
    : argv.includes('config') ? { exitCode: 0, stdout: CONFIG } : { exitCode: 2, stdout: '', stderr: 'megamaid.py: no' }
}

test('a brief dispatched to the agent config names passes', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1'); answerResolve(r, 'megamaid:planner')
  const res = await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: say(briefPath(STEM, 'plan', 'planner')) }))
  expect(res.deny).toBeUndefined()
  expect(Object.keys(r.writes.at(-1)?.agents ?? {})).toEqual(['a1'])
})

test('a planner dispatched with the implementer brief is denied', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1'); answerResolve(r, 'megamaid:implementer')
  const res = await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: implPrompt('Repository: /r\nInstruction file: /r/p/X1.md\n') }))
  expect(res.deny).toContain('megamaid:implementer')
  expect(res.deny).toContain('planner, x-planner')
  expect(res.deny).toContain('megamaid.py brief --skill fix --role <role> --run ' + FIX_STEM)
  expect(r.writes).toHaveLength(0)
})

test('a resolve exit 2 passes the spawn and logs it', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1')
  const res = await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: say(briefPath(STEM, 'plan', 'planner')) }))
  expect(res.deny).toBeUndefined()
  expect(r.logs).toContain('resolve plan/planner exited 2: megamaid.py: role x is not in agents (deleted or never defined)')
})

test('a foreign override resolving to general-purpose passes as general-purpose', async ($, on) => {
  const r = rig(on); answerSpawns(on, () => 'a1'); answerResolve(r, 'general-purpose')
  const res = await $.agent.spawn(spawnInput({ subagentType: 'general-purpose', provider: FOREIGN, prompt: say(briefPath(STEM, 'plan', 'planner')) }))
  expect(res.deny).toBeUndefined()
})

test('a throwing spawn hook denies a briefed spawn and passes a briefless one', async ($, on) => {
  rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  on('state.get', () => ({ deny: 'no state' }))
  const briefed = await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  expect(briefed.deny).toContain('megamaid guard fault')
  const briefless = await $.agent.spawn(spawnInput({ subagentType: 'megamaid:pattern-scanner' }))
  expect(briefless.deny).toBeUndefined()
  expect(briefless.agentId).toBe('a1')
})

test('vacu-suck coerces the resolve (control: review does not)', async ($, on) => {
  const r = rig(on); answerSkills(on); answerSpawns(on, () => 'a1')
  await $.skill.prompt({ skill: 'megamaid:review', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  await $.skill.prompt({ skill: 'megamaid:vacu-suck', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  const resolves = r.argvs.filter(a => a.includes('resolve')).map(a => a.slice(3))
  expect(resolves).toEqual([
    ['resolve', '--role', 'code-reviewer', '--lane', 'review'],
    ['resolve', '--role', 'code-reviewer', '--lane', 'review', '--coerce', 'vacu_suck'],
  ])
})

// The model the spawn reaches core with, per call.
function captureModels(on: On): (string | undefined)[] {
  const seen: (string | undefined)[] = []
  let n = 0
  on('agent.spawn', (_$, e) => { seen.push(e.model); return { model: e.model ?? 'inherit', agentId: 'm' + ++n } })
  return seen
}
// resolve answers the model named after its lane, so each lane's mapping shows in the model.
function answerLaneModels(r: ReturnType<typeof rig>) {
  r.process = argv => {
    if (!argv.includes('resolve')) return { exitCode: 2, stdout: '', stderr: 'megamaid.py: no' }
    const lane = String(argv[argv.indexOf('--lane') + 1])
    const coerced = argv.includes('--coerce') ? '+vs' : ''
    const type = lane.startsWith('fix.implementer') ? 'megamaid:implementer' : lane === 'plan' ? 'megamaid:planner' : 'megamaid:code-reviewer'
    return { exitCode: 0, stdout: RESOLVE(type, 'model-' + lane + coerced) }
  }
}

test("a briefed spawn without a model gets config's, per lane", async ($, on) => {
  const r = rig(on); answerSkills(on); const seen = captureModels(on); answerLaneModels(r)
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:planner', prompt: say(briefPath(STEM, 'plan', 'planner')) }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer', prompt: implPrompt('Class: trivial\n') }))
  await $.agent.spawn(spawnInput({ subagentType: 'megamaid:implementer', prompt: implPrompt('Item: M1\n') }))
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(FIX_STEM, 'fix', 'code-reviewer')) }))
  expect(seen).toEqual(['model-review', 'model-plan', 'model-fix.implementer_trivial', 'model-fix.implementer_standard', 'model-fix.reviewer'])
})

test('vacu-suck coerces the model', async ($, on) => {
  const r = rig(on); answerSkills(on); const seen = captureModels(on); answerLaneModels(r)
  await $.skill.prompt({ skill: 'megamaid:vacu-suck', text: 'x' })
  await $.agent.spawn(spawnInput({ prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  expect(seen).toEqual(['model-review+vs'])
})

test('a briefed spawn that names a model keeps it; a briefless spawn keeps its own', async ($, on) => {
  const r = rig(on); answerSkills(on); const seen = captureModels(on); answerLaneModels(r)
  await $.agent.spawn(spawnInput({ model: 'haiku', prompt: say(briefPath(STEM, 'review', 'code-reviewer')) }))
  await $.agent.spawn(spawnInput({ subagentType: 'Explore', provider: FOREIGN }))
  await $.agent.spawn(spawnInput({ model: 'sonnet', subagentType: 'Explore', provider: FOREIGN }))
  expect(seen).toEqual(['haiku', undefined, 'sonnet'])
})
