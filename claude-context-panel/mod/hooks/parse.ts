// Pure helpers for the context pane: no `$`, so tests can call them directly.

export type Context = { todos: string[]; pins: string[] }

export type Segment = { text: string } | { href: string; label: string }

// A URL, or an absolute path that starts a token (so `ok/fail` is not one).
const LINK = /(https?:\/\/\S+)|(?<=^|\s)(\/[^\s]+)/g

export function parseContext(text: string): Context {
  const todos: string[] = []
  const pins: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const todo = /^todo:\s*(.*)$/.exec(line)
    if (todo) todos.push(todo[1] ?? '')
    else pins.push(line)
  }
  return { todos, pins }
}

export function shortPath(path: string): string {
  return path.split('/').filter(Boolean).slice(-2).join('/')
}

export function linkify(line: string): Segment[] {
  const out: Segment[] = []
  let at = 0
  for (const m of line.matchAll(LINK)) {
    const start = m.index ?? 0
    if (start > at) out.push({ text: line.slice(at, start) })
    if (m[1]) out.push({ href: m[1], label: m[1] })
    else if (m[2]) out.push({ href: `file://${m[2]}`, label: shortPath(m[2]) })
    at = start + m[0].length
  }
  if (at < line.length) out.push({ text: line.slice(at) })
  return out
}

export type NumberedLine = { n: number; text: string }

// Lines with the number context-add takes for them: the file's line number, blanks counted.
export function numberedContext(text: string): { todos: NumberedLine[]; pins: NumberedLine[] } {
  const todos: NumberedLine[] = []
  const pins: NumberedLine[] = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line === '') return
    const todo = /^todo:\s*(.*)$/.exec(line)
    if (todo) todos.push({ n: i + 1, text: todo[1] ?? '' })
    else pins.push({ n: i + 1, text: line })
  })
  return { todos, pins }
}

export type ArchivedLine = { line: number; at: string; how: string; todo: boolean; text: string }

const HOW = ['완료', '삭제', '밀려남']

// .panel-context.archive, newest first, each with its line in the file (the file only grows
// at the end, so that index stays put). Lines from before removals were archived have no
// "how" column: those were all pushed out by the cap.
export function parseArchive(text: string): ArchivedLine[] {
  const out: ArchivedLine[] = []
  text.split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return
    const cols = raw.split('\t')
    const pushedOut = !(cols.length >= 3 && HOW.includes(cols[1] ?? ''))
    const how = pushedOut ? '밀려남' : (cols[1] ?? '')
    const line = cols.slice(pushedOut ? 1 : 2).join('\t').trim()
    const todo = /^todo:\s*(.*)$/.exec(line)
    out.push({ line: i, at: cols[0] ?? '', how, todo: todo !== null, text: todo ? (todo[1] ?? '') : line })
  })
  return out.reverse()
}
