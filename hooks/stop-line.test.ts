import { test, expect } from 'claude-code/testing'
import { STOP_LINE, STOP_TOKEN, TOKEN_LINE } from './stop-line'

test('the stop line asks for exactly TOKEN_LINE, which leads with STOP_TOKEN', () => {
  expect(STOP_LINE).toContain('`' + TOKEN_LINE + '`')
  expect(TOKEN_LINE.startsWith(STOP_TOKEN + ':')).toBe(true)
})
