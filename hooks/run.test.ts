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
