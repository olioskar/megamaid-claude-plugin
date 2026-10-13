import type { MegamaidRun } from '../types'

// Pure helpers for run detection. No $ here, and no state ref: each file that writes state
// declares its own RUN const (validate reads a ref only as a literal const of that file).

export function isRunSkill(name: string): boolean {
  return name.startsWith('megamaid:') && name !== 'megamaid:help'
}

export function startRun(id: string, skill: string, startedAt: number): MegamaidRun {
  return { id, skill, startedAt, agents: {} }
}
