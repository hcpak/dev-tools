// The file section: which tool calls produced or opened a file, and how many rows
// each section gets. Ported from the terminal panel (context-panel) so both agree.

export type FileHit = { path: string; made: boolean }

const MAX_FILES = 10
// A path token; \p{L} keeps non-ASCII file names whole.
const PATH_RE = /(?:~|\/)[\p{L}\p{N}_./\-+@]{3,}/gu
// A shell command only contributes paths when it creates something.
//   (?<![0-9&])  fd redirects (2>, &>) send diagnostics, not deliverables
//   (?!/dev/null) and a redirect into /dev/null creates nothing
const WRITE_CMD = new RegExp(
  String.raw`\b(?:cp|mv|tee|touch|install|rsync|ditto)\b` +
    String.raw`|(?<![0-9&])>>?\s*(?!/dev/null)["'~/]` +
    // Tools that name their destination with a flag instead of a redirect.
    String.raw`|--(?:screenshot|output|out)[= ]`,
)
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
  let haystack: string
  let made = true
  if (WRITERS.has(tool)) {
    haystack = String(input.file_path ?? input.notebook_path ?? '')
  } else if (tool === 'Read') {
    haystack = String(input.file_path ?? '')
    made = false
  } else {
    haystack = JSON.stringify(input)
    if (!WRITE_CMD.test(haystack)) return list
  }
  let out = list
  for (const [match] of haystack.matchAll(PATH_RE)) {
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
