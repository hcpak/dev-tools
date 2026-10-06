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
