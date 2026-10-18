import type { Register } from 'claude-code'
import { registerSkillPrompt } from './skill-prompt'
import { registerReadNote } from './read-note'
import { registerAgents } from './agents'
import { registerUsage } from './usage'
import { registerSession } from './session'

export const register: Register = on => {
  registerSkillPrompt(on)
  registerReadNote(on)
  registerAgents(on)
  registerUsage(on)
  registerSession(on)
}
