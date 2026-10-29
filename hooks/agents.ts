import { update } from 'claude-code'
import type { CoreEngineInterface, On } from 'claude-code'
import type { MegamaidBoundary } from '../types'
import { firstLine, field, joinPath, parseWriteSet } from './guard-rules'
import { addAgent, parseBrief, startRun } from './run'
import type { Brief } from './run'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// Records megamaid's own main-loop dispatches: a prompt that names a run brief, or (the briefless
// scanner and shaver) a megamaid-provided agent while the stored run is patterns. A spawn nested in
// a recorded agent is recorded under the parent's lane, role and stem. The stored run is the last
// run, not an active one, so nothing else is attributed to it. A main-loop briefed implementer or
// planner is recorded with its write boundary (guards.ts reads it), worked out before the spawn starts.
export function registerAgents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const brief = e.parentAgentId === undefined ? parseBrief(e.prompt) : null
    const boundary = brief === null ? null : await boundaryFor($, brief, e.prompt)
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
      boundary,
    }))
    $.ui.log(`${brief?.lane ?? '-'}/${brief?.role ?? 'unknown'} spawned as ${e.subagentType} (${agentId})`, { to: 'debug' })
    return r
  }).catch(($, e, next) => next(e))
}

type SpawnDollar = Pick<CoreEngineInterface, 'process' | 'plugin'>

// A fix implementer's write-set (megamaid.py write-set on its instruction) or a planner's output file,
// from the dispatch prompt's shared context. Anything missing gives an empty boundary with the reason,
// so every edit is refused and says why; any other agent has none.
async function boundaryFor($: SpawnDollar, brief: Brief, prompt: string): Promise<MegamaidBoundary | null> {
  const root = field(prompt, 'Repository')
  if (brief.lane === 'fix' && brief.role === 'implementer') {
    const instruction = field(prompt, 'Instruction file')
    if (root === null || instruction === null) {
      return { kind: 'write-set', root, paths: [], note: 'the prompt names no Instruction file or Repository line' }
    }
    const p = await $.process.run(['python3', '-I', `${$.plugin.root}/scripts/megamaid.py`, 'write-set', '--file', instruction])
    const paths = p.exitCode === 0 ? parseWriteSet(p.stdout) : null
    if (paths === null) return { kind: 'write-set', root, paths: [], note: firstLine(p.stderr) ?? `write-set exited ${p.exitCode}` }
    return { kind: 'write-set', root, paths, note: null }
  }
  if (brief.lane === 'plan' && brief.role === 'planner') {
    const output = field(prompt, 'Output file')
    if (output === null) return { kind: 'output-file', root, paths: [], note: 'the prompt names no Output file line' }
    if (root === null && !output.startsWith('/')) {
      return { kind: 'output-file', root, paths: [], note: 'the Output file is relative and the prompt names no Repository line' }
    }
    return { kind: 'output-file', root, paths: [root === null ? output : joinPath(root, output)], note: null }
  }
  return null
}
