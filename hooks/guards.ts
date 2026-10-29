import type { CoreEngineInterface, On } from 'claude-code'
import type { MegamaidBoundary } from '../types'
import { DENY_PAST_HEAD, denyEmptyWriteSet, denyOutsideOutputFile, denyOutsideWriteSet, normalize, pastHead, within } from './guard-rules'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// Call-time guards on megamaid's own agents. A call is checked only when its agentId is a recorded
// agent of the stored run; a main-loop call and any other agent's call pass. Fail closed: a fault
// refuses the subagent's call (another plugin's included, once) and passes the main loop's.
export function registerGuards(on: On): void {
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (e.agentId === undefined) return next(e)
    const reason = await refuseWrite($, e.agentId, String(e.file_path))
    return reason === null ? next(e) : { deny: reason }
  }).catch(($, e, next) => next.called ? next(e) : e.agentId === undefined ? next(e) : { deny: 'megamaid: write boundary (megamaid guard fault)' })
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    if (e.agentId === undefined) return next(e)
    const reason = await refuseWrite($, e.agentId, String(e.file_path))
    return reason === null ? next(e) : { deny: reason }
  }).catch(($, e, next) => next.called ? next(e) : e.agentId === undefined ? next(e) : { deny: 'megamaid: write boundary (megamaid guard fault)' })
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.agentId === undefined) return next(e)
    const { value: run } = await $.state.get(RUN)
    const a = run?.agents[e.agentId]
    if (a === undefined || a.lane !== 'fix' || a.role === 'implementer' || !pastHead(String(e.command))) return next(e)
    return { deny: DENY_PAST_HEAD }
  }).catch(($, e, next) => next.called ? next(e) : e.agentId === undefined ? next(e) : { deny: 'megamaid: fix reviewer diff base (megamaid guard fault)' })
}

type GuardDollar = Pick<CoreEngineInterface, 'fs' | 'state'>

// The deny reason for a recorded agent's Edit or Write, or null to let it through.
async function refuseWrite($: GuardDollar, agentId: string, file: string): Promise<string | null> {
  const { value: run } = await $.state.get(RUN)
  const b: MegamaidBoundary | null | undefined = run?.agents[agentId]?.boundary
  if (b === null || b === undefined) return null
  if (b.kind === 'write-set') {
    if (b.paths.length === 0) return denyEmptyWriteSet(b.note)
    const target = await realPath($, file)
    const root = b.root === null ? null : await realPath($, b.root)
    if (root !== null && target.startsWith(root + '/')) {
      const rel = target.slice(root.length + 1)
      if (within(rel, b.paths)) return null
    }
    return denyOutsideWriteSet(file, b.paths)
  }
  const output = b.paths[0]
  if (output === undefined) return denyOutsideOutputFile(file, null, b.note)
  return (await realPath($, file)) === (await realPath($, output)) ? null : denyOutsideOutputFile(file, output, b.note)
}

// The path with symlinks resolved: stat it, else its nearest existing parent plus the rest (a planner's
// first Write lands in a folder not made yet; a missing path's stat throws ENOENT), else lexically.
async function realPath($: GuardDollar, path: string): Promise<string> {
  const p = normalize(path)
  const parts = p.split('/')
  for (let i = parts.length; i > 1; i--) {
    const head = parts.slice(0, i).join('/')
    let real: string | undefined
    try { real = (await $.fs.stat(head, { resolve: true })).realPath } catch { real = undefined }
    if (real !== undefined) return normalize([real, ...parts.slice(i)].join('/'))
  }
  return p
}
