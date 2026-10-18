import { update } from 'claude-code'
import type { CoreEngineInterface, On } from 'claude-code'
import type { MegamaidRun } from '../types'
import { ZERO, addUsage, ledgerPath, renderLedger, usageKey } from './ledger'

const RUN = { plugin: 'megamaid', key: 'run' } as const

const GITIGNORE = '.megamaid/.gitignore'

// Records what each turn of a stored run cost: the main loop's to the orchestrator, a recorded
// agent's to that agent; every other turn counts nowhere. The hook refuses nothing and rewrites
// nothing: a fault means a missing or stale ledger.
export function registerUsage(on: On): void {
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const usage = e.usage
    if (usage === undefined) return r
    const { value: stored } = await $.state.get(RUN)
    if (stored === null || stored === undefined) return r
    const agentId = e.agentId
    if (agentId !== undefined && stored.agents[agentId] === undefined) return r
    const now = await $.clock.now()
    const run = await update($, RUN, run => {
      if (run === null || run === undefined) return null
      if (agentId === undefined) return { ...run, usage: addUsage(run.usage, usage), lastTurnAt: now }
      const agent = run.agents[agentId]
      if (agent === undefined) return run
      return { ...run, agents: { ...run.agents, [agentId]: { ...agent, usage: addUsage(agent.usage ?? ZERO, usage) } }, lastTurnAt: now }
    })
    if (run === null) return r
    const agent = agentId === undefined ? undefined : run.agents[agentId]
    const key = agentId === undefined ? 'orchestrator' : agent === undefined ? agentId : usageKey(agent)
    const turns = agentId === undefined ? run.usage.turns : agent?.usage?.turns ?? 0
    const input = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
    $.ui.log(`usage ${key} +${input}/${usage.output_tokens} (${turns})`, { to: 'debug' })
    await writeLedger($, run)
    return r
  }).catch(($, e, next) => next(e))
}

type LedgerDollar = Pick<CoreEngineInterface, 'fs' | 'session' | 'ui'>

// Writes the run's ledger where ledgerPath puts it; nothing when it has no place yet. The
// self-ignoring .megamaid/.gitignore goes first when the ledger lives under .megamaid/.
export async function writeLedger($: LedgerDollar, run: MegamaidRun): Promise<void> {
  const path = ledgerPath(run)
  if (path === null) return
  try {
    if (path.startsWith('.megamaid/') && !(await $.fs.exists(GITIGNORE))) await $.fs.write(GITIGNORE, '*\n')
    const cost = await $.session.usage().then(u => u.cost?.usd ?? null, () => null)
    await $.fs.write(path, renderLedger(run, cost))
    $.ui.log(`ledger ${path}`, { to: 'debug' })
  } catch (err) {
    $.ui.log(`ledger failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
  }
}
