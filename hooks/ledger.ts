import type { TurnUsage } from 'claude-code'
import type { MegamaidAgent, MegamaidRun, MegamaidUsage } from '../types'

// Pure helpers for the usage ledger. No $ here.

export const ZERO: MegamaidUsage = { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, model: null }

// The runs whose ledger sits beside the review report they write.
export const REPORT_SKILLS: readonly string[] = ['megamaid:review', 'megamaid:vacu-suck']

// megamaid.py report-name's shape, repeated here in a second language: <pr-N|branch-…>-round<N>-report.md.
// check-contract keeps the two equal.
export const REPORT_NAME = /^(pr-\d+|branch-.+)-round\d+-report\.md$/

export function addUsage(u: MegamaidUsage, t: TurnUsage): MegamaidUsage {
  return {
    turns: u.turns + 1,
    input: u.input + t.input_tokens,
    cacheRead: u.cacheRead + t.cache_read_input_tokens,
    cacheWrite: u.cacheWrite + t.cache_creation_input_tokens,
    output: u.output + t.output_tokens,
    model: t.model,
  }
}

// The ledger row an agent is summed into: <lane>/<role> for a briefed dispatch, its agent type otherwise.
export function usageKey(agent: MegamaidAgent): string {
  return agent.lane === null ? agent.subagentType : `${agent.lane}/${agent.role}`
}

export function reportName(path: string): boolean {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  return REPORT_NAME.test(base)
}

// Where a run's ledger goes: beside the report for a report run (null until it has one), else
// .megamaid/usage/<skill>-<startedAt>.md, relative to the working directory.
export function ledgerPath(run: MegamaidRun): string | null {
  if (REPORT_SKILLS.includes(run.skill)) {
    if (run.report === null) return null
    return run.report.replace(/-report\.md$/, '-usage.md')
  }
  return `.megamaid/usage/${run.skill.replace(/^megamaid:/, '')}-${run.startedAt}.md`
}

type Row = { key: string; agents: number; usage: MegamaidUsage; models: string[] }

function sum(a: MegamaidUsage, b: MegamaidUsage): MegamaidUsage {
  return {
    turns: a.turns + b.turns, input: a.input + b.input, cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite, output: a.output + b.output, model: null,
  }
}

function share(part: number, total: number): string {
  return `${total === 0 ? 0 : Math.round((100 * part) / total)}%`
}

function inputOf(u: MegamaidUsage): number {
  return u.input + u.cacheRead + u.cacheWrite
}

function iso(ms: number | null): string {
  return ms === null ? 'none yet' : new Date(ms).toISOString()
}

export function renderLedger(run: MegamaidRun, costNow: number | null): string {
  const rows: Row[] = [{ key: 'orchestrator', agents: 0, usage: run.usage, models: run.usage.model === null ? [] : [run.usage.model] }]
  const byKey = new Map<string, Row>()
  for (const agent of Object.values(run.agents)) {
    const key = usageKey(agent)
    let row = byKey.get(key)
    if (row === undefined) { row = { key, agents: 0, usage: ZERO, models: [] }; byKey.set(key, row); rows.push(row) }
    row.agents += 1
    if (agent.usage !== null) {
      row.usage = sum(row.usage, agent.usage)
      if (agent.usage.model !== null && !row.models.includes(agent.usage.model)) row.models.push(agent.usage.model)
    }
  }
  const total = rows.reduce<Row>(
    (acc, r) => ({ key: 'total', agents: acc.agents + r.agents, usage: sum(acc.usage, r.usage), models: [] }),
    { key: 'total', agents: 0, usage: ZERO, models: [] })
  const cost = run.costAtStart === null || costNow === null
    ? 'Cost: unavailable (no session cost at run start or now)'
    : `Cost: ${(costNow - run.costAtStart).toFixed(2)} USD (session spend from run start to the last counted turn; includes anything else in the session meanwhile)`
  const line = (r: Row, agents: string, models: string) =>
    `| ${r.key} | ${agents} | ${r.usage.turns} | ${r.usage.input} | ${r.usage.cacheRead} | ${r.usage.cacheWrite} | ${r.usage.output} | ${models} |`
  return [
    `# megamaid usage: ${run.skill}`,
    '',
    `Run: started ${iso(run.startedAt)}, last turn ${iso(run.lastTurnAt)} (UTC)`,
    cost,
    '',
    '| Lane/role | Agents | Turns | Input | Cache read | Cache write | Output | Model |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r, i) => line(r, i === 0 ? '-' : String(r.agents), r.models.length === 0 ? '-' : r.models.join(', '))),
    line(total, String(total.agents), ''),
    '',
    `Orchestrator share: ${share(inputOf(run.usage), inputOf(total.usage))} of input tokens, ${share(run.usage.output, total.usage.output)} of output tokens.`,
    '',
  ].join('\n')
}
