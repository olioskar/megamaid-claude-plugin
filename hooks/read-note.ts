import type { On } from 'claude-code'
import { SKIP_NOTE, STOP_SKILLS } from './stop-line'

// vacu-suck and fix-auto Read sub-skill files that open with the stop line. While the module is
// loaded, their main-loop Read gets a note that the line does not apply; with no module there is
// no note and the run stops. The hook refuses nothing: a fault means no note, which stops the run.
export function registerReadNote(on: On): void {
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const r = await next(e)
    if (e.tool !== 'Read' || e.agentId !== undefined) return r
    if (r.deny !== undefined || r.isError === true) return r
    const path = String(e.file_path)
    if (!/[\\/]SKILL\.md$/.test(path)) return r
    const root = (await $.fs.stat($.plugin.root, { resolve: true })).realPath
    const real = (await $.fs.stat(path, { resolve: true })).realPath
    if (root === undefined || real === undefined) return r
    const name = skillName(root, real)
    if (name === null || !STOP_SKILLS.includes(name)) return r
    return { ...r, context: [...(r.context ?? []), SKIP_NOTE] }
  }).catch(($, e, next) => next(e))
}

// The skill a resolved path names when it is <root>/skills/<name>/SKILL.md, else null.
function skillName(root: string, real: string): string | null {
  if (!real.startsWith(root)) return null
  const m = /^[\\/]skills[\\/]([^\\/]+)[\\/]SKILL\.md$/.exec(real.slice(root.length))
  return m?.[1] ?? null
}
