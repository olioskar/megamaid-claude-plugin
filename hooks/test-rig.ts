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
