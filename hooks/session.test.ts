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
