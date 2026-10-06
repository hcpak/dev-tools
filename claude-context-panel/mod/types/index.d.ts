export type WrittenFile = { path: string; made: boolean }

declare module 'claude-code' {
  interface PluginState {
    'context-pane': { files: WrittenFile[]; isHidden: boolean }
  }
}
