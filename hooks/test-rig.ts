import { mock } from 'claude-code/testing'
import type { AgentSpawnInput, On, SessionEndInput } from 'claude-code'
import type { MegamaidRun } from '../types'

export type Rig = { logs: string[]; writes: (MegamaidRun | null)[] }

// Shared setup. Register every test hook before the test's first $ call (the kit refuses later ones).
// A clock (unless withheld), a ui.log answer that collects lines, and a state.set recorder that keeps
// each landed write (the test's $ has no state noun; next(e) lets update()'s ifVersion retry work).
export function rig(on: On, opts: { clock?: boolean } = {}): Rig {
  if (opts.clock !== false) mock.clock(on, { now: 1000 })
  const logs: string[] = []
  on('ui.log', (_$, e) => { logs.push(e.text); return { value: undefined } })
  const writes: (MegamaidRun | null)[] = []
  on('state.set', async (_$, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.value.isSet) writes.push(e.value as MegamaidRun | null)
    return r
  })
  return { logs, writes }
}

export const MEGAMAID = { plugin: 'megamaid@inline', tier: 'user' } as const
export const FOREIGN = { plugin: 'other@market', tier: 'user' } as const

export function spawnInput(over: Partial<AgentSpawnInput> = {}): AgentSpawnInput {
  return {
    tool_use_id: 't1', prompt: 'do it', description: 'd', subagentType: 'megamaid:code-reviewer',
    provider: MEGAMAID, parentModel: 'claude-opus-5-5', background: false, fork: false, ...over,
  }
}

export function endInput(): SessionEndInput {
  return { reason: 'clear', sessionId: 's1', resume: { id: 's1' } }
}

export function briefPath(stem: string, lane: string, role: string): string {
  return `/w/.megamaid/excerpts/${stem}.${lane}.${role}.brief.md`
}

// Read-note tests. The kit's $.plugin.root is the plugin folder; fs.stat answers map spellings to
// real paths. Any other path (the plugin root among them) resolves to REAL, so in every Read test
// the root is reached through a different spelling, as a linked root or marketplace cache would be.
// LINK_FILE is a symlinked spelling of review's skill file.
export const REAL = '/real/megamaid'
export const LINK_FILE = '/link/skills/review/SKILL.md'
export function answerStat(on: On): void {
  on('fs.stat', (_$, e) => {
    const realPath = e.path === LINK_FILE ? REAL + '/skills/review/SKILL.md'
      : e.path.startsWith(REAL + '/') || e.path.startsWith('/other/') ? e.path
      : REAL
    // The engine fills realPath only when the caller asks to resolve; so does this answer.
    return { value: { kind: 'file' as const, size: 1, mtimeMs: 0, isLink: e.path === LINK_FILE, ...(e.resolve ? { realPath } : {}) } }
  })
}
export type ReadAnswer = 'ok' | 'deny' | 'error'
export function answerRead(on: On, how: () => ReadAnswer = () => 'ok'): void {
  on('tool.call', { tool: 'Read' }, (_$, e) => {
    const h = how()
    if (h === 'deny') return { deny: 'no' }
    if (h === 'error') return { isError: true as const, result: 'boom', text: 'boom' }
    return { result: { type: 'text' as const, file: { filePath: String(e.file_path), content: 'x', numLines: 1, startLine: 1, totalLines: 1 } } }
  })
}
