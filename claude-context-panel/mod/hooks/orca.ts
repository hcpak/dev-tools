// Orca (the terminal app) keeps its own tab title; /rename does not reach it.

// The terminal handle of this pane, from `orca terminal list --json` output and
// ORCA_PANE_KEY ("<tab id>:<leaf id>"). Undefined outside Orca or on bad output.
export function handleForPane(listJson: string, paneKey: string | undefined): string | undefined {
  const leaf = paneKey?.split(':').at(-1)
  if (!leaf) return undefined
  try {
    const parsed = JSON.parse(listJson) as { result?: { terminals?: { handle?: string; leafId?: string }[] } }
    return parsed.result?.terminals?.find(t => t.leafId === leaf)?.handle
  } catch {
    return undefined
  }
}
