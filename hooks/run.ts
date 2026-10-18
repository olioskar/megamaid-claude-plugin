import type { MegamaidAgent, MegamaidRun } from '../types'
import { ZERO } from './ledger'

// Pure helpers for run detection. No $ here, and no state ref: each file that writes state
// declares its own RUN const (validate reads a ref only as a literal const of that file).

export function isRunSkill(name: string): boolean {
  return name.startsWith('megamaid:') && name !== 'megamaid:help'
}

export function startRun(id: string, skill: string, startedAt: number, costAtStart: number | null = null): MegamaidRun {
  return { id, skill, startedAt, agents: {}, usage: ZERO, report: null, costAtStart, lastTurnAt: null }
}

// A run brief: .megamaid/excerpts/<stem>.<lane>.<role>.brief.md, written by megamaid.py brief.
// <stem> is <skill>-<digits>-<hex4>; <lane> is the brief's skill (review, plan, fix); <role> is a
// config key, unrestricted, so it is whatever stands between <lane>. and .brief.md.
const BRIEF = /\.megamaid[\\/]excerpts[\\/]([a-z][a-z-]*-[0-9]+-[0-9a-f]{4})\.([a-z][a-z-]*)\.([^\s\\/]+?)\.brief\.md/

export type Brief = { runStem: string; lane: string; role: string }

export function parseBrief(prompt: string): Brief | null {
  const m = BRIEF.exec(prompt)
  if (m === null) return null
  const [, runStem, lane, role] = m
  if (runStem === undefined || lane === undefined || role === undefined) return null
  return { runStem, lane, role }
}

export function addAgent(run: MegamaidRun, agentId: string, agent: MegamaidAgent): MegamaidRun {
  return { ...run, agents: { ...run.agents, [agentId]: agent } }
}
