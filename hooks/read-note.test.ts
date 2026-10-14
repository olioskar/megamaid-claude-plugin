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

test('a path outside the root gets no note, even one the length of the root or sharing its prefix (control: review under the root does)', async ($, on) => {
  rig(on); answerStat(on); answerRead(on)
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/skills/review/SKILL.md' })).context).toEqual([SKIP_NOTE])
  expect('/fake/megamaid'.length).toBe(REAL.length)
  expect((await $.tool.call({ tool: 'Read', file_path: '/fake/megamaid/skills/review/SKILL.md' })).context).toBeUndefined()
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '2/skills/review/SKILL.md' })).context).toBeUndefined()
})

test('another stop-line skill (vacu-suck) gets the note too', async ($, on) => {
  rig(on); answerStat(on); answerRead(on)
  expect((await $.tool.call({ tool: 'Read', file_path: REAL + '/skills/vacu-suck/SKILL.md' })).context).toEqual([SKIP_NOTE])
})
