import { update } from 'claude-code'
import type { On } from 'claude-code'

const RUN = { plugin: 'megamaid', key: 'run' } as const

export function registerSession(on: On): void {
  // smoke.sh reads this line to know the module loaded.
  on('session.start', async ($, e, next) => {
    const { version } = await $.session.version()
    $.ui.log(`module loaded (Claude Code ${version})`, { to: 'debug' })
    return next(e)
  })
  // /clear ends the conversation too; the next skill starts a fresh run.
  on('session.end', async ($, e, next) => {
    await update($, RUN, () => null)
    return next(e)
  }).catch(($, e, next) => next(e))
}
