export type WrittenFile = { path: string; made: boolean }

// /ctx steps through these in order.
export type BandView = 'open' | 'folded' | 'hidden'

declare module 'claude-code' {
  interface PluginState {
    'context-pane': { files: WrittenFile[]; view: BandView }
  }
}
