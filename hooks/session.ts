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
  // /clear ends the conversation too; the next skill starts a fresh run. next first: the chain
  // shares one time limit, so the write spends what is left after the other hooks.
  on('session.end', async ($, e, next) => {
    const r = await next(e)
    await update($, RUN, () => null)
    return r
  }).catch(($, e, next) => next(e))
}
