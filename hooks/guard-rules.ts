import type { Brief } from './run'

// Pure rules for the call-time guards. No $ here: agents.ts and guards.ts call these.

// The models lane a brief's dispatch resolves under: the fix implementer's from the prompt's
// `Class:` line (standard when absent); null for a lane megamaid.py resolve is not run for.
export function laneFor(brief: Brief, prompt: string): string | null {
  if (brief.lane === 'review' || brief.lane === 'plan') return brief.lane
  if (brief.lane !== 'fix') return null
  if (brief.role !== 'implementer') return 'fix.reviewer'
  return /^Class:[ \t]*trivial[ \t]*$/m.test(prompt) ? 'fix.implementer_trivial' : 'fix.implementer_standard'
}

// megamaid.py resolve's subagent_type and model lines; null when either is missing.
export function parseResolve(stdout: string): { subagentType: string; model: string } | null {
  const t = /^subagent_type:[ \t]*(\S+)[ \t]*$/m.exec(stdout)?.[1]
  const m = /^model:[ \t]*(\S+)[ \t]*$/m.exec(stdout)?.[1]
  return t === undefined || m === undefined ? null : { subagentType: t, model: m }
}

// The config roles (megamaid.py config's JSON) whose subagent_type is this one, sorted; none on bad JSON.
export function rolesFor(configJson: string, subagentType: string): string[] {
  let cfg: unknown
  try { cfg = JSON.parse(configJson) } catch { return [] }
  const agents = (cfg as { agents?: unknown } | null)?.agents
  if (agents === null || typeof agents !== 'object') return []
  return Object.entries(agents as Record<string, { subagent_type?: unknown } | null>)
    .filter(([, spec]) => spec?.subagent_type === subagentType).map(([role]) => role).sort()
}

export function denyMisfit(brief: Brief, expected: string, actual: string, roles: readonly string[], root: string): string {
  return `megamaid: the ${brief.lane}/${brief.role} brief is for ${expected}, but this spawn is ${actual}. ` +
    `Config roles that resolve to ${actual}: ${roles.length === 0 ? 'none' : roles.join(', ')}. ` +
    `Dispatch ${expected} with this brief, or write the brief for the role you dispatch: ` +
    `python3 -I ${root}/scripts/megamaid.py brief --skill ${brief.lane} --role <role> --run ${brief.runStem} …`
}

// The first `<label>: <value>` line of a dispatch prompt's shared context, or null.
export function field(prompt: string, label: string): string | null {
  const re = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':[ \\t]*(.+?)[ \\t]*$', 'm')
  return re.exec(prompt)?.[1] ?? null
}

// Lexical: drops `.` and empty parts, applies `..`, no trailing `/`.
export function normalize(path: string): string {
  const abs = path.startsWith('/')
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length > 0 && out.at(-1) !== '..') out.pop()
      else if (!abs) out.push('..')
      continue
    }
    out.push(part)
  }
  const joined = (abs ? '/' : '') + out.join('/')
  return joined === '' ? '.' : joined
}

export function joinPath(root: string, path: string): string {
  return path.startsWith('/') ? path : root + '/' + path
}

// A write-set entry stands for a file, or for everything under a directory.
export function within(rel: string, entries: readonly string[]): boolean {
  return entries.some(entry => {
    const e = normalize(entry)
    return rel === e || rel.startsWith(e + '/')
  })
}

// megamaid.py write-set's line: `write-set: <path> …` or `write-set: (none)`; null when absent.
export function parseWriteSet(stdout: string): string[] | null {
  const m = /^write-set:[ \t]*(.*)$/m.exec(stdout)
  if (m === null) return null
  const v = (m[1] ?? '').trim()
  return v === '(none)' ? [] : v.split(/\s+/).filter(p => p !== '')
}

export function firstLine(text: string): string | null {
  const line = text.split('\n').find(l => l.trim() !== '')
  return line === undefined ? null : line.trim()
}

// A fix reviewer diffs the item's uncommitted change against HEAD; HEAD~ or HEAD^ reaches a batch-mate's commit.
export function pastHead(command: string): boolean {
  return /HEAD[~^]/.test(command)
}

export const DENY_PAST_HEAD = "megamaid: a fix reviewer diffs against HEAD, never past it: HEAD may hold a batch-mate's commit and the item is uncommitted. Run git diff HEAD -- <files reported by implementer>, and git status --porcelain -- <those files> for new ones."

const STOP = 'stop, change nothing more, and report it as a divergence.'

export function denyOutsideWriteSet(file: string, paths: readonly string[]): string {
  return `megamaid: ${file} is outside this item's write-set (${paths.join(' ')}). Edits outside the instruction's ## Where are refused: ${STOP}`
}

export function denyEmptyWriteSet(note: string | null): string {
  return `megamaid: this item has no write-set (${note ?? 'the instruction names no file'}), so the instruction is defective and every edit is refused: ${STOP}`
}

export function denyOutsideOutputFile(file: string, output: string | null, note: string | null): string {
  return output === null
    ? `megamaid: a planner writes only the output file its prompt names, and none is known (${note ?? 'no Output file line'}); ${file} is refused: ${STOP}`
    : `megamaid: a planner writes only its output file (${output}); ${file} is refused: ${STOP}`
}
