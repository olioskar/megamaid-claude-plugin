// The stop line is copied into every skill but help (check-contract §11 keeps the copies equal to
// STOP_LINE). The module strips it; with no module the model reads it and stops.
export const STOP_LINE = "STOP. megamaid's hooks module is not loaded in this session, so everything below this line is disabled: do not follow it, run no tools, and reply only with `MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help`."
export const STOP_TOKEN = 'MEGAMAID-MODULE-NOT-LOADED'
export const TOKEN_LINE = 'MEGAMAID-MODULE-NOT-LOADED: run /megamaid:help'
export const SKIP_NOTE = "megamaid's hooks module is loaded; the STOP line at the top of this file does not apply."
export const STOP_SKILLS: readonly string[] = ['configure', 'fix', 'fix-auto', 'patterns', 'plan', 'review', 'vacu-suck']

export function stripStopLine(text: string): string {
  return text.split('\n').filter(line => line.replace(/\r$/, '') !== STOP_LINE).join('\n')
}
