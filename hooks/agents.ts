import { update } from 'claude-code'
import type { On } from 'claude-code'
import { addAgent, parseBrief, startRun } from './run'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// Records megamaid's own main-loop dispatches: a prompt that names a run brief, or (the briefless
// scanner and shaver) a megamaid-provided agent while the stored run is patterns. A spawn nested in
// a recorded agent is recorded under the parent's lane, role and stem. The stored run is the last
// run, not an active one, so nothing else is attributed to it. The hook refuses nothing.
export function registerAgents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId === undefined) return r
    const agentId = r.agentId
    const parentId = e.parentAgentId
    if (parentId !== undefined) {
      const { value: stored } = await $.state.get(RUN)
      const parent = stored?.agents[parentId]
      if (parent === undefined) return r
      await update($, RUN, run => {
        const p = run?.agents[parentId]
        if (run === null || run === undefined || p === undefined) return run ?? null
        return addAgent(run, agentId, {
          subagentType: e.subagentType, provider: e.provider.plugin,
          role: p.role, lane: p.lane, runStem: p.runStem, parent: parentId, usage: null,
        })
      })
      $.ui.log(`${parent.lane ?? '-'}/${parent.role} nested spawn ${e.subagentType} (${agentId}) under ${parentId}`, { to: 'debug' })
      return r
    }
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
      parent: null,
      usage: null,
    }))
    $.ui.log(`${brief?.lane ?? '-'}/${brief?.role ?? 'unknown'} spawned as ${e.subagentType} (${agentId})`, { to: 'debug' })
    return r
  }).catch(($, e, next) => next(e))
}
