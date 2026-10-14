export type MegamaidAgent = { subagentType: string; provider: string; role: string; lane: string | null; runStem: string | null }
export type MegamaidRun = { id: string; skill: string; startedAt: number; agents: Record<string, MegamaidAgent> }
declare module 'claude-code' {
  interface PluginState {
    megamaid: { run: MegamaidRun | null }
  }
}
