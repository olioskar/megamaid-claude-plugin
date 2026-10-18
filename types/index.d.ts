export type MegamaidUsage = { turns: number; input: number; cacheRead: number; cacheWrite: number; output: number; model: string | null }
export type MegamaidAgent = { subagentType: string; provider: string; role: string; lane: string | null; runStem: string | null; parent: string | null; seq: number; usage: MegamaidUsage | null }
export type MegamaidRun = { id: string; skill: string; startedAt: number; agents: Record<string, MegamaidAgent>; usage: MegamaidUsage; report: string | null; costAtStart: number | null; lastTurnAt: number | null }
declare module 'claude-code' {
  interface PluginState {
    megamaid: { run: MegamaidRun | null }
  }
}
