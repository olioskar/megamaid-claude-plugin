import { mock } from 'claude-code/testing'
import type { AgentSpawnInput, On, SessionEndInput, TurnCompleteInput } from 'claude-code'
import type { MegamaidRun } from '../types'

export type Rig = {
  logs: string[]
  writes: (MegamaidRun | null)[]
  // Every fs.write, in order: [path, text]. files holds the last text per path.
  fsWrites: [string, string][]
  files: Record<string, string>
  // Paths fs.exists answers true for.
  exists: Set<string>
  // What session.usage answers as cost.usd; null leaves cost out.
  cost: number | null
  // When true, fs.write (or fs.exists) is denied.
  failWrites: boolean
  failExists: boolean
}

// Shared setup. Register every test hook before the test's first $ call (the kit refuses later ones).
// A clock (unless withheld), a ui.log answer that collects lines, a state.set recorder that keeps
// each landed write (the test's $ has no state noun; next(e) lets update()'s ifVersion retry work),
// an fs.write recorder, an fs.exists answer, a session.usage answer (unless withheld) and a
// turn.complete answer.
export function rig(on: On, opts: { clock?: boolean; usage?: boolean } = {}): Rig {
  if (opts.clock !== false) mock.clock(on, { now: 1000 })
  const logs: string[] = []
  on('ui.log', (_$, e) => { logs.push(e.text); return { value: undefined } })
  const writes: (MegamaidRun | null)[] = []
  on('state.set', async (_$, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.value.isSet) writes.push(e.value as MegamaidRun | null)
    return r
  })
  const r: Rig = { logs, writes, fsWrites: [], files: {}, exists: new Set(), cost: 3.5, failWrites: false, failExists: false }
  // The kit hands a relative path to fs.write and fs.exists already resolved against the test
  // session's cwd (the plugin folder); the recorder keeps a .megamaid/ path relative so tests
  // match the spec's spelling.
  on('fs.write', (_$, e) => {
    if (r.failWrites) return { deny: 'disk full' }
    const path = dotMegamaid(e.path)
    r.fsWrites.push([path, e.text]); r.files[path] = e.text
    return { value: undefined }
  })
  on('fs.exists', (_$, e) => r.failExists ? { deny: 'no stat' } : { value: r.exists.has(dotMegamaid(e.path)) })
  if (opts.usage !== false) on('session.usage', () => ({ value: {
    startedAt: 0, context: { window: 200000 }, rateLimits: [], ...(r.cost === null ? {} : { cost: { usd: r.cost } }),
  } }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  return r
}

function dotMegamaid(path: string): string {
  const i = path.indexOf('/.megamaid/')
  return i < 0 ? path : path.slice(i + 1)
}

export function turnInput(over: Partial<TurnCompleteInput> = {}): TurnCompleteInput {
  return {
    reason: 'answer', answer: 'ok', durationMs: 10, isAborted: false, turnId: 'turn1',
    usage: { input_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 10, output_tokens: 50, model: 'claude-opus-5-5' },
    ...over,
  } as TurnCompleteInput
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
// real paths; paths under REAL (a sibling like REAL + '2' too), /other/ and /fake/ resolve to
// themselves. Any other path (the plugin root among them) resolves to REAL, so in every Read test
// the root is reached through a different spelling, as a linked root or marketplace cache would be.
// LINK_FILE is a symlinked spelling of review's skill file.
export const REAL = '/real/megamaid'
export const LINK_FILE = '/link/skills/review/SKILL.md'
export function answerStat(on: On): void {
  on('fs.stat', (_$, e) => {
    const realPath = e.path === LINK_FILE ? REAL + '/skills/review/SKILL.md'
      : e.path.startsWith(REAL) || e.path.startsWith('/other/') || e.path.startsWith('/fake/') ? e.path
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
