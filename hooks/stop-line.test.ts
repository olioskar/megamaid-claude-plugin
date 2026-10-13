import { test, expect } from 'claude-code/testing'
import { STOP_LINE, STOP_TOKEN, TOKEN_LINE } from './stop-line'
import { rig } from './test-rig'

test('the stop line asks for exactly TOKEN_LINE, which leads with STOP_TOKEN', () => {
  expect(STOP_LINE).toContain('`' + TOKEN_LINE + '`')
  expect(TOKEN_LINE.startsWith(STOP_TOKEN + ':')).toBe(true)
})

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
