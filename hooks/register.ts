import type { Register } from 'claude-code'
import { registerSkillPrompt } from './skill-prompt'

export const register: Register = on => {
  registerSkillPrompt(on)
}
