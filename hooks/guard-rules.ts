// Pure rules for the call-time guards. No $ here: agents.ts and guards.ts call these.

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
