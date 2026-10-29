import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { MegamaidAgent, MegamaidBoundary, MegamaidRun } from '../types'
import { ZERO } from './ledger'
import { answerRealpaths, rig, seedRun } from './test-rig'

const IMPL: MegamaidBoundary = { kind: 'write-set', root: '/r', paths: ['src/a.ts', 'src/dir'], note: null }

function agent(over: Partial<MegamaidAgent>): MegamaidAgent {
  return { subagentType: 'megamaid:implementer', provider: 'megamaid@inline', role: 'implementer', lane: 'fix',
    runStem: 'fix-1760000100-cd34', parent: null, seq: 0, usage: null, ...over }
}
function run(agents: Record<string, MegamaidAgent>): MegamaidRun {
  return { id: 'r1', skill: 'megamaid:fix', startedAt: 1, agents, usage: ZERO, report: null, costAtStart: null, lastTurnAt: null, owed: true }
}
// The tool's own answer: a deny that names itself, so a passed call reads 'answered'.
function answerTools(on: On) {
  on('tool.call', { tool: 'Edit' }, () => ({ deny: 'answered' }))
  on('tool.call', { tool: 'Write' }, () => ({ deny: 'answered' }))
  on('tool.call', { tool: 'Bash' }, () => ({ deny: 'answered' }))
}
function edit(file_path: string, agentId?: string) {
  return { tool: 'Edit' as const, file_path, old_string: 'a', new_string: 'b', ...(agentId === undefined ? {} : { agentId }) }
}
function write(file_path: string, agentId?: string) {
  return { tool: 'Write' as const, file_path, content: 'x', ...(agentId === undefined ? {} : { agentId }) }
}

test('an implementer edit inside its write-set passes', async ($, on) => {
  rig(on); answerRealpaths(on); answerTools(on); seedRun(on, run({ a1: agent({ boundary: IMPL }) }))
  expect((await $.tool.call(edit('/r/src/a.ts', 'a1'))).deny).toBe('answered')
  expect((await $.tool.call(write('/r/src/dir/n.ts', 'a1'))).deny).toBe('answered')
})

test('an implementer edit outside its write-set is denied with the write-set named', async ($, on) => {
  rig(on); answerRealpaths(on); answerTools(on); seedRun(on, run({ a1: agent({ boundary: IMPL }) }))
  for (const f of ['/r/src/b.ts', '/r/src/dirx.ts', '/elsewhere/src/a.ts']) {
    const r = await $.tool.call(edit(f, 'a1'))
    expect(r.deny).toContain('src/a.ts src/dir')
    expect(r.deny).toContain('report it as a divergence')
  }
})

test('a symlinked spelling of the root is the same file', async ($, on) => {
  rig(on); answerRealpaths(on, { '/tmp/r': '/private/r' }); answerTools(on)
  seedRun(on, run({ a1: agent({ boundary: { ...IMPL, root: '/tmp/r' } }) }))
  expect((await $.tool.call(edit('/private/r/./src/a.ts', 'a1'))).deny).toBe('answered')
  expect((await $.tool.call(edit('/tmp/r/src/a.ts', 'a1'))).deny).toBe('answered')
})

test('an implementer creating a file in a new folder inside a directory entry passes', async ($, on) => {
  rig(on); answerRealpaths(on, {}, ['/r/src/dir/new']); answerTools(on); seedRun(on, run({ a1: agent({ boundary: IMPL }) }))
  expect((await $.tool.call(write('/r/src/dir/new/x.ts', 'a1'))).deny).toBe('answered')
  expect((await $.tool.call(write('/r/src/other/x.ts', 'a1'))).deny).toContain('outside')
})

test('a write-set entry spelled as an absolute path matches the same file', async ($, on) => {
  rig(on); answerRealpaths(on, { '/tmp/r': '/private/r' }); answerTools(on)
  seedRun(on, run({ a1: agent({ boundary: { ...IMPL, root: '/tmp/r', paths: ['/tmp/r/src/a.ts', '/tmp/r/src/dir'] } }) }))
  expect((await $.tool.call(edit('/private/r/src/a.ts', 'a1'))).deny).toBe('answered')
  expect((await $.tool.call(write('/tmp/r/src/dir/n.ts', 'a1'))).deny).toBe('answered')
  expect((await $.tool.call(edit('/private/r/src/b.ts', 'a1'))).deny).toContain('outside')
})

test('an empty write-set denies every edit and says the instruction is defective', async ($, on) => {
  rig(on); answerRealpaths(on); answerTools(on)
  seedRun(on, run({ a1: agent({ boundary: { ...IMPL, paths: [], note: 'megamaid.py: /r/p/M1.md: No such file or directory' } }) }))
  const r = await $.tool.call(edit('/r/src/a.ts', 'a1'))
  expect(r.deny).toContain('defective')
  expect(r.deny).toContain('No such file or directory')
})

test('a planner writes only its output file', async ($, on) => {
  rig(on); answerRealpaths(on); answerTools(on)
  seedRun(on, run({ p1: agent({ role: 'planner', lane: 'plan', boundary: { kind: 'output-file', root: '/r', paths: ['/r/plans/M1-a.md'], note: null } }) }))
  expect((await $.tool.call(write('/r/plans/M1-a.md', 'p1'))).deny).toBe('answered')
  const r = await $.tool.call(edit('/r/src/a.ts', 'p1'))
  expect(r.deny).toContain('/r/plans/M1-a.md')
  expect(r.deny).toContain('report it as a divergence')
})

test("a planner's first write into a folder that does not exist yet passes", async ($, on) => {
  rig(on); answerRealpaths(on, { '/tmp/r': '/private/r' }, ['/private/r/plans/plan-for-x']); answerTools(on)
  seedRun(on, run({ p1: agent({ role: 'planner', lane: 'plan',
    boundary: { kind: 'output-file', root: '/tmp/r', paths: ['/tmp/r/plans/plan-for-x/M1-a.md'], note: null } }) }))
  expect((await $.tool.call(write('/private/r/plans/plan-for-x/M1-a.md', 'p1'))).deny).toBe('answered')
})

test('main-loop, unrecorded and unbounded calls pass', async ($, on) => {
  rig(on); answerRealpaths(on); answerTools(on)
  seedRun(on, run({ a1: agent({ boundary: IMPL }), c1: agent({ role: 'code-reviewer', boundary: null }), o1: agent({ role: 'code-reviewer' }) }))
  expect((await $.tool.call(edit('/r/src/b.ts'))).deny).toBe('answered')
  expect((await $.tool.call(edit('/r/src/b.ts', 'zz'))).deny).toBe('answered')
  expect((await $.tool.call(edit('/r/src/b.ts', 'c1'))).deny).toBe('answered')
  expect((await $.tool.call(write('/r/src/b.ts', 'o1'))).deny).toBe('answered')
})

test("a throwing guard denies a subagent's call and passes a main-loop call", async ($, on) => {
  rig(on); answerRealpaths(on); answerTools(on)
  on('state.get', () => ({ deny: 'no state' }))
  expect((await $.tool.call(edit('/r/src/a.ts', 'a1'))).deny).toContain('megamaid guard fault')
  expect((await $.tool.call(write('/r/src/a.ts', 'a1'))).deny).toContain('megamaid guard fault')
  expect((await $.tool.call(edit('/r/src/a.ts'))).deny).toBe('answered')
})

function bash(command: string, agentId?: string) {
  return { tool: 'Bash' as const, command, ...(agentId === undefined ? {} : { agentId }) }
}
const REVIEWERS = { r1: agent({ role: 'code-reviewer' }), i1: agent({ boundary: IMPL }), v1: agent({ role: 'code-reviewer', lane: 'review' }) }

test("a fix reviewer's diff past HEAD is denied with the HEAD form named", async ($, on) => {
  rig(on); answerTools(on); seedRun(on, run(REVIEWERS))
  for (const c of ['git diff HEAD~1 -- src/a.ts', 'git diff HEAD^ src/a.ts']) {
    const r = await $.tool.call(bash(c, 'r1'))
    expect(r.deny).toContain('git diff HEAD -- <files reported by implementer>')
  }
  expect((await $.tool.call(bash('git diff HEAD -- src/a.ts', 'r1'))).deny).toBe('answered')
})

test("an implementer's, a review-lane reviewer's, an unrecorded agent's and the main loop's HEAD~1 pass", async ($, on) => {
  rig(on); answerTools(on); seedRun(on, run(REVIEWERS))
  for (const id of ['i1', 'v1', 'zz', undefined]) {
    expect((await $.tool.call(bash('git diff HEAD~1', id))).deny).toBe('answered')
  }
})

test("a throwing Bash guard denies a subagent's call and passes a main-loop call", async ($, on) => {
  rig(on); answerTools(on)
  on('state.get', () => ({ deny: 'no state' }))
  expect((await $.tool.call(bash('git status', 'r1'))).deny).toContain('megamaid guard fault')
  expect((await $.tool.call(bash('git status'))).deny).toBe('answered')
})
