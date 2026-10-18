import { test, expect } from 'claude-code/testing'
import { ZERO, addUsage, ledgerPath, renderLedger, reportName, usageKey } from './ledger'
import { startRun, addAgent } from './run'
import type { MegamaidAgent, MegamaidUsage } from '../types'

const u = (turns: number, input: number, cacheRead: number, cacheWrite: number, output: number, model: string | null = 'm'): MegamaidUsage =>
  ({ turns, input, cacheRead, cacheWrite, output, model })
const agent = (over: Partial<MegamaidAgent> = {}): MegamaidAgent => ({
  subagentType: 'megamaid:code-reviewer', provider: 'megamaid@inline', role: 'code-reviewer', lane: 'review', runStem: 's', parent: null, usage: null, ...over,
})

test('renderLedger: orchestrator first, keys in first-seen order, distinct models per key, a total row, the two shares', () => {
  let run = startRun('r', 'megamaid:review', 0, 1)
  run = { ...run, usage: u(3, 100, 900, 0, 60), lastTurnAt: 61000, report: '/w/pr-1-round1-report.md' }
  run = addAgent(run, 'a1', agent({ usage: u(1, 50, 0, 50, 20) }))
  run = addAgent(run, 'a2', agent({ role: 'simplifier', usage: u(2, 100, 100, 0, 20) }))
  run = addAgent(run, 'a3', agent({ usage: u(1, 100, 0, 0, 0) }))
  run = addAgent(run, 'a4', agent({ usage: null }))
  run = addAgent(run, 'a5', agent({ role: 'simplifier', usage: u(1, 0, 0, 0, 0, 'n') }))
  const text = renderLedger(run, 3.5)
  const rows = text.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| Lane'))
  expect(rows).toEqual([
    '| orchestrator | - | 3 | 100 | 900 | 0 | 60 | m |',
    '| review/code-reviewer | 3 | 2 | 150 | 0 | 50 | 20 | m |',
    '| review/simplifier | 2 | 3 | 100 | 100 | 0 | 20 | m, n |',
    '| total | 5 | 8 | 350 | 1000 | 50 | 100 |  |',
  ])
  expect(text).toContain('# megamaid usage: megamaid:review')
  expect(text).toContain('Run: started 1970-01-01T00:00:00.000Z, last turn 1970-01-01T00:01:01.000Z (UTC)')
  expect(text).toContain('Cost: 2.50 USD (session spend from run start to the last counted turn; includes anything else in the session meanwhile)')
  // 1000/1400 of input, 60/100 of output
  expect(text).toContain('Orchestrator share: 71% of input tokens, 60% of output tokens.')
})

test('renderLedger: zero totals give 0%, a briefless agent keys by subagentType, no cost reads unavailable', () => {
  let run = startRun('r', 'megamaid:patterns', 0)
  run = addAgent(run, 'a1', agent({ subagentType: 'megamaid:pattern-scanner', role: 'unknown', lane: null, runStem: null }))
  const text = renderLedger(run, null)
  expect(text).toContain('Orchestrator share: 0% of input tokens, 0% of output tokens.')
  expect(text).toContain('| megamaid:pattern-scanner | 1 | 0 | 0 | 0 | 0 | 0 | - |')
  expect(text).toContain('Cost: unavailable (no session cost at run start or now)')
  expect(text).toContain('last turn none yet (UTC)')
})

test('renderLedger rounds the share to the nearest percent', () => {
  let run = startRun('r', 'megamaid:plan', 0)
  run = { ...run, usage: u(1, 2, 0, 0, 1) }
  run = addAgent(run, 'a1', agent({ usage: u(1, 1, 0, 0, 2) }))
  expect(renderLedger(run, null)).toContain('Orchestrator share: 67% of input tokens, 33% of output tokens.')
})

test('addUsage sums the four counts, bumps turns and keeps the last model', () => {
  const t = { input_tokens: 1, cache_read_input_tokens: 2, cache_creation_input_tokens: 3, output_tokens: 4, model: 'x' }
  expect(addUsage(ZERO, t)).toEqual(u(1, 1, 2, 3, 4, 'x'))
  expect(addUsage(addUsage(ZERO, t), { ...t, model: 'y' })).toEqual(u(2, 2, 4, 6, 8, 'y'))
})

test('usageKey: lane/role with a lane, subagentType without', () => {
  expect(usageKey(agent())).toBe('review/code-reviewer')
  expect(usageKey(agent({ lane: null, subagentType: 'megamaid:pattern-shaver' }))).toBe('megamaid:pattern-shaver')
})

test('reportName matches report-name shapes by basename, either separator', () => {
  expect(reportName('/w/docs/pr-12-round1-report.md')).toBe(true)
  expect(reportName('C:\\w\\branch-feat-x-round3-report.md')).toBe(true)
  expect(reportName('pr-1-round1-report.md')).toBe(true)
  expect(reportName('/w/pr-12-round1-usage.md')).toBe(false)
  expect(reportName('/w/pr-12-report.md')).toBe(false)
  expect(reportName('/pr-12-round1-report.md/notes.md')).toBe(false)
})

test('ledgerPath: beside the report, under .megamaid/usage for other skills, null for a report run with no report', () => {
  expect(ledgerPath(startRun('r', 'megamaid:review', 5))).toBeNull()
  expect(ledgerPath({ ...startRun('r', 'megamaid:vacu-suck', 5), report: '/w/branch-x-round1-report.md' })).toBe('/w/branch-x-round1-usage.md')
  expect(ledgerPath(startRun('r', 'megamaid:plan', 5))).toBe('.megamaid/usage/plan-5.md')
  expect(ledgerPath(startRun('r', 'none', 5))).toBe('.megamaid/usage/none-5.md')
})
