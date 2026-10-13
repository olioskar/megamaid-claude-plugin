import { update } from 'claude-code'
import type { On } from 'claude-code'
import { stripStopLine } from './stop-line'
import { isRunSkill, startRun } from './run'

const RUN = { plugin: 'megamaid', key: 'run' } as const

// One registration on purpose: if a second skill.prompt hook of this plugin threw, the strip would
// be lost and a loaded module would read as "not loaded". Run start sits in try; the .catch
// replays next (nothing beneath runs twice) and strips, so an overrun cannot cost the strip either.
export function registerSkillPrompt(on: On): void {
  on('skill.prompt', { skill: /^megamaid:/ }, async ($, e, next) => {
    const text = stripStopLine((await next(e)).text)
    try {
      if (isRunSkill(e.skill)) {
        const run = startRun(crypto.randomUUID(), e.skill, await $.clock.now())
        await update($, RUN, () => run)
        $.ui.log(`run ${e.skill} started (${run.id})`, { to: 'debug' })
      }
    } catch (err) {
      $.ui.log(`run detection failed: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
    }
    return { text }
  }).catch(async ($, e, next) => ({ text: stripStopLine((await next(e)).text) }))
}
