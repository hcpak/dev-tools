// The file section: which tool calls produced or opened a file, and how many rows
// each section gets. Ported from the terminal panel (context-panel) so both agree.

export type FileHit = { path: string; made: boolean }

const MAX_FILES = 10
// A path token; \p{L} keeps non-ASCII file names whole.
const PATH_RE = /(?:~|\/)[\p{L}\p{N}_./\-+@]{3,}/gu
const PATH_ONE = new RegExp(`^${PATH_RE.source}`, 'u')
// What a shell command writes: a redirect target, a flag-named output, the last
// argument of a copy or move, every argument of tee or touch. The paths it reads
// or runs in (cd, a script's input) are not deliverables.
//   (?<![0-9&])  fd redirects (2>, &>) send diagnostics, not deliverables
//   (?!/dev/null) and a redirect into /dev/null creates nothing
const REDIRECT_RE = /(?<![0-9&])>>?\s*(?!\/dev\/null)["']?([~/][^\s"';|&<>]+)/gu
// Tools that name their destination with a flag instead of a redirect.
const FLAG_OUT_RE = /--(?:screenshot|output|out)[= ]["']?([~/][^\s"';|&<>]+)/gu
const SEGMENT_SPLIT = /&&|\|\||[;|\n]/
const COPIERS = new Set(['cp', 'mv', 'install', 'rsync', 'ditto'])
const NAMERS = new Set(['tee', 'touch'])

function writtenPaths(command: string): string[] {
  const out: string[] = []
  for (const segment of command.split(SEGMENT_SPLIT)) {
    for (const m of segment.matchAll(REDIRECT_RE)) out.push(m[1])
    for (const m of segment.matchAll(FLAG_OUT_RE)) out.push(m[1])
    const words = segment.replace(REDIRECT_RE, ' ').trim().split(/\s+/)
    while (words[0] === 'sudo' || /^\w+=/.test(words[0] ?? '')) words.shift()
    const verb = words.shift() ?? ''
    const args = words.map(w => w.replace(/^["']|["']$/g, '')).filter(w => /^[~/]/.test(w))
    if (COPIERS.has(verb) && args.length >= 2) out.push(args[args.length - 1])
    if (NAMERS.has(verb)) out.push(...args)
  }
  return out.flatMap(path => path.match(PATH_ONE)?.[0] ?? [])
}

// Arguments that are prose, not shell: quoting a command is not running it.
const PROSE_TOOLS = new Set(['Agent', 'Task', 'TaskCreate', 'TaskUpdate', 'SendMessage'])
const WRITERS = new Set(['Write', 'Edit', 'NotebookEdit'])
const SKIP_DIRS = ['.claude/', 'bin/']
const SKIP_NAMES = new Set(['README.md', 'LICENSE', 'CHANGELOG.md', '.gitignore'])

function isDeliverable(path: string, home: string): boolean {
  if (!path.startsWith(`${home}/`)) return false
  const rest = path.slice(home.length + 1)
  if (SKIP_DIRS.some(dir => rest.startsWith(dir))) return false
  return !SKIP_NAMES.has(rest.split('/').at(-1) ?? '')
}

// The list runs oldest to newest; a file mentioned again moves to the end, and
// reading a file back never undoes having made it.
export function harvestCall(
  list: FileHit[],
  tool: string,
  input: Record<string, unknown>,
  home: string,
): FileHit[] {
  if (PROSE_TOOLS.has(tool)) return list
  let paths: string[]
  let made = true
  if (WRITERS.has(tool)) {
    paths = [String(input.file_path ?? input.notebook_path ?? '')]
  } else if (tool === 'Read') {
    paths = [String(input.file_path ?? '')]
    made = false
  } else {
    paths = writtenPaths(typeof input.command === 'string' ? input.command : JSON.stringify(input))
  }
  let out = list
  for (const match of paths.flatMap(text => [...text.matchAll(PATH_RE)].map(m => m[0]))) {
    const path = match.startsWith('~') ? home + match.slice(1) : match
    if (!isDeliverable(path, home)) continue
    const wasMade = out.find(one => one.path === path)?.made ?? false
    out = [...out.filter(one => one.path !== path), { path, made: made || wasMade }]
  }
  return out
}

// Newest first, files of one folder together, made before only opened.
export function orderFiles(list: FileHit[], exists: Set<string>): FileHit[] {
  const groups = new Map<string, FileHit[]>()
  for (const hit of [...list].reverse()) {
    if (!exists.has(hit.path)) continue
    const dir = hit.path.slice(0, hit.path.lastIndexOf('/'))
    groups.set(dir, [...(groups.get(dir) ?? []), hit])
  }
  return [...groups.values()]
    .flatMap(group => [...group.filter(f => f.made), ...group.filter(f => !f.made)])
    .slice(0, MAX_FILES)
}

// Rows per section, so a long section cannot starve the others: every kept
// section gets one item, the rest is filled in priority order, rules go first
// when rows are scarce, and the lowest-priority sections go after that.
export function allocate(sizes: number[], avail: number): { rule: boolean; counts: number[] } {
  const rule = avail >= 4 * sizes.length
  const cost = rule ? 2 : 1
  const kept = [...sizes]
  while (kept.length > 0 && kept.length * cost > avail) kept.pop()
  let spare = avail - kept.length * cost
  const counts = kept.map(size => {
    const extra = Math.min(size - 1, spare)
    spare -= extra
    return 1 + extra
  })
  return { rule, counts }
}
