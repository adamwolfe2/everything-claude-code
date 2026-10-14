export type Chip = { label: string; command?: string; fill?: string }
export type HqDeploy = { project: string; team: string; state: string; isProd: boolean; createdAt: number; url: string }
export type HqItem = { repo: string; number: number; title: string; url: string; state: string }
export type Hq = { deploys: HqDeploy[]; prs: HqItem[]; queue: HqItem[]; updatedAt: number; errors: string[] }

declare module 'claude-code' {
  interface PluginState {
    autopilot: { chips: Chip[]; hq: Hq | null }
  }
}
