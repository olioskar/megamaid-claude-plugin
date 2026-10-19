import { update } from 'claude-code'
import type { CoreEngineInterface, HookFailure, On } from 'claude-code'
import type { MegamaidRun } from '../types'
import { REPORT_SKILLS, ZERO, addUsage, ledgerPath, renderLedger, reportName, usageKey } from './ledger'

const RUN = { plugin: 'megamaid', key: 'run' } as const

const GITIGNORE = '.megamaid/.gitignore'

// Records what each turn of a stored run cost: the main loop's to the orchestrator, a recorded
// agent's to that agent; every other turn counts nowhere. Finds the review report a review or sweep
// writes so the ledger can sit beside it. Neither hook refuses or rewrites anything: a fault means
// a missing or stale ledger.
export function registerUsage(on: On): void {
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const usage = e.usage
    if (usage === undefined) return r
    const { value: stored } = await $.state.get(RUN)
    if (stored === null || stored === undefined) return r
    // A run stored before the ledger (a 0.3.x run across a hot reload) has no usage; it is left uncounted.
    if (stored.usage === undefined) return r
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
  }).catch(($, e, next) => { failed($, next.error); return next(e) })

  // The main loop's first Write of a file named like megamaid.py report-name's output, in a review
  // or sweep run, names the report; a sweep's later rounds leave it.
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const r = await next(e)
    if (e.tool !== 'Write' || e.agentId !== undefined) return r
    if (r.deny !== undefined || r.isError === true) return r
    const path = String(e.file_path)
    if (!reportName(path)) return r
    const { value: stored } = await $.state.get(RUN)
    if (stored === null || stored === undefined || !REPORT_SKILLS.includes(stored.skill) || stored.report !== null) return r
    const run = await update($, RUN, run => run === null || run === undefined ? null : { ...run, report: run.report ?? path })
    if (run !== null) await writeLedger($, run)
    return r
  }).catch(($, e, next) => { failed($, next.error); return next(e) })
}

// A failed hook is replayed beneath and named in the debug log.
function failed($: Pick<CoreEngineInterface, 'ui'>, error: HookFailure): void {
  $.ui.log(`usage hook failed: ${error.message ?? error.kind}`, { to: 'debug' })
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
