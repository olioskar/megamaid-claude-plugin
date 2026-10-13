import type { Register } from 'claude-code'
import { registerSkillPrompt } from './skill-prompt'
import { registerReadNote } from './read-note'

export const register: Register = on => {
  registerSkillPrompt(on)
  registerReadNote(on)
}
