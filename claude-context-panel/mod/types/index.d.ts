export type WrittenFile = { path: string; made: boolean }

// /ctx steps through these in order.
export type BandView = 'open' | 'folded' | 'hidden'

// A bare /done or /unpin turns the band into a list to press; 'archive' shows what left.
export type BandPick = 'none' | 'todo' | 'pin' | 'archive'

declare module 'claude-code' {
  interface PluginState {
    'context-pane': { files: WrittenFile[]; view: BandView; pick: BandPick }
  }
}
