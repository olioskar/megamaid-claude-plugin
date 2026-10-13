import { update } from 'claude-code'
import type { On } from 'claude-code'
import { addAgent, parseBrief, startRun } from './run'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// Records megamaid's own main-loop dispatches: a prompt that names a run brief, or (the briefless
// scanner and shaver) a megamaid-provided agent while the stored run is patterns. The stored run is
// the last run, not an active one, so nothing else is attributed to it. The hook refuses nothing.
export function registerAgents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (e.parentAgentId !== undefined || r.agentId === undefined) return r
    const agentId = r.agentId
    const brief = parseBrief(e.prompt)
    if (brief === null) {
      if (e.provider.plugin.split('@')[0] !== 'megamaid') return r
      const { value: stored } = await $.state.get(RUN)
      if (stored?.skill !== 'megamaid:patterns') return r
    }
    const now = await $.clock.now()
    const fresh = crypto.randomUUID()
    await update($, RUN, run => addAgent(run ?? startRun(fresh, 'none', now), agentId, {
      subagentType: e.subagentType,
      provider: e.provider.plugin,
      role: brief?.role ?? 'unknown',
      lane: brief?.lane ?? null,
      runStem: brief?.runStem ?? null,
    }))
    $.ui.log(`${brief?.lane ?? '-'}/${brief?.role ?? 'unknown'} spawned as ${e.subagentType} (${agentId})`, { to: 'debug' })
    return r
  }).catch(($, e, next) => next(e))
}
