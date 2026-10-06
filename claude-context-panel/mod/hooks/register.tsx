import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { WrittenFile } from '../types'

import { allocate, harvestCall, orderFiles } from './files'
import { handleForPane } from './orca'
import { linkify, parseContext, shortPath } from './parse'

const files = atom({ plugin: 'context-pane', key: 'files' } as const, [] as WrittenFile[])
const isHidden = atom({ plugin: 'context-pane', key: 'isHidden' } as const, false)

const RENAME_TOOL = 'mcp__context-pane__rename_session'
const MAX_TITLE = 120

const pad = (n: number) => String(n).padStart(2, '0')

// HH:MM:SS in the panel's zone (CONTEXT_PANEL_UTC_OFFSET, KST by default).
function clockText(now: number, offsetHours: number): string {
  const t = new Date(now + offsetHours * 3_600_000)
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`
}

// Orca's tab title is its own; set it too so the tab matches the session name.
async function renameOrcaTab($: EngineInterface, title: string): Promise<void> {
  const listed = await $.process.run(['orca', 'terminal', 'list', '--json'])
  const handle = handleForPane(listed.stdout, await $.env.get('ORCA_PANE_KEY'))
  if (handle) await $.process.run(['orca', 'terminal', 'rename', '--terminal', handle, '--title', title])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ctx',
      description: 'Show or hide the context band (todos, pins, files)',
    })
    await $.tool.register({
      name: 'rename_session',
      description:
        'Rename the current Claude Code session (same as the person typing /rename). ' +
        'Use right after identifying the tracker task a session works on, with the title ' +
        'format "[module] short summary (#task-number)". The rename applies once the turn ends.',
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string', description: 'The new session title' } },
        required: ['title'],
      },
    })
    // Rebuild the file list from the transcript, so a resumed session keeps its files.
    const home = (await $.env.get('HOME')) ?? ''
    let list: WrittenFile[] = []
    for (const message of await $.session.messages()) {
      if (message.role !== 'assistant') continue
      for (const use of message.toolUses) list = harvestCall(list, use.tool, use.input, home)
    }
    await update($, files, () => list)
    // context-add also runs outside tool calls (hooks, another shell).
    $.clock.every(10_000, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('command.run', { command: 'ctx' }, async $ => {
    const hidden = await update($, isHidden, was => !was)

    return { text: hidden ? 'Context band hidden.' : 'Context band shown.' }
  })

  on('tool.call', { tool: RENAME_TOOL }, ($, e) => {
    // MCP-style tools carry their arguments under `input`.
    const call = e as { title?: unknown; input?: { title?: unknown } }
    const raw = call.input?.title ?? call.title
    const title = typeof raw === 'string' ? raw.trim() : ''
    if (title === '' || title.length > MAX_TITLE) {
      const reason = `title must be 1-${MAX_TITLE} characters`
      return { result: reason, text: reason, isError: true }
    }
    // /rename cannot run inside a hook the turn waits on; queue it for when the session is idle.
    $.clock.after(0, () => {
      void $.command.run({ command: 'rename', args: title }).catch(() => undefined)
      void renameOrcaTab($, title).catch(() => undefined)
    })
    const done = `Session will be renamed to "${title}" when this turn ends.`
    return { result: done, text: done }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    // The main session only: a subagent's files are its own work, as in the terminal panel.
    if (e.agentId === undefined) {
      const home = (await $.env.get('HOME')) ?? ''
      const { tool, ...input } = e as { tool: string } & Record<string, unknown>
      const before = await read($, files)
      const after = harvestCall(before, tool, input, home)
      if (after !== before) await update($, files, () => after)
    }
    $.ui.invalidate('ui.render')

    return ran
  }).catch(($, e, next) => next(e)) // a failure here must never cost the tool call

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const { Box, Text, Link } = $.ui.resolve(e)
    const home = await $.env.get('HOME')
    const pinLabel = (await $.env.get('CONTEXT_PANEL_PIN_LABEL')) ?? '핀'
    const offset = Number((await $.env.get('CONTEXT_PANEL_UTC_OFFSET')) ?? 9)
    const session = await $.session.id()
    const raw = await $.fs
      .read(`${home}/.claude/tasks/${session}/.panel-context`)
      .catch(() => '')
    const { todos, pins } = parseContext(typeof raw === 'string' ? raw : '')
    const list = await read($, files)
    const exists = new Set<string>()
    for (const hit of list) if (await $.fs.exists(hit.path).catch(() => false)) exists.add(hit.path)
    const shown = orderFiles(list, exists)

    let header = 'CONTEXT'
    if (todos.length > 0) header += `  할 일 ${todos.length}`
    header += `  ${pinLabel} ${pins.length}`
    if (shown.length > 0) header += ` · 파일 ${shown.length}`
    header += ` · ${session} · ${clockText(await $.clock.now(), offset)}`

    const linked = (line: string) =>
      linkify(line).map(seg =>
        'href' in seg ? <Link href={seg.href}>{seg.label}</Link> : seg.text,
      )
    const sections = [
      { label: '할 일', color: 'yellow', rows: todos.map(t => <Text wrap="truncate-end"><Text color="yellow">☐</Text> {linked(t)}</Text>) },
      { label: pinLabel, color: 'magenta', rows: pins.map(p => <Text wrap="truncate-end"><Text color="magenta">▸</Text> {linked(p)}</Text>) },
      {
        label: '파일',
        color: 'green',
        rows: shown.map(f => (
          <Text wrap="truncate-end">
            {f.made ? <Text color="green">✎</Text> : <Text dimColor>👁</Text>}{' '}
            <Link href={`file://${f.path}`}>{shortPath(f.path)}</Link>
          </Text>
        )),
      },
    ].filter(s => s.rows.length > 0)

    const out = [<Text color="cyan" bold wrap="truncate-end">{header}</Text>]
    if (sections.length === 0) out.push(<Text dimColor>(기록된 것 없음)</Text>)
    const { rule, counts } = allocate(sections.map(s => s.rows.length), e.props.maxRows - 1)
    counts.forEach((count, i) => {
      const s = sections[i]
      if (!s) return
      if (rule) {
        const title = count >= s.rows.length ? s.label : `${s.label} ${count}/${s.rows.length}`
        out.push(<Text color={s.color} bold>── {title} ──</Text>)
      }
      out.push(...s.rows.slice(0, count))
    })

    return <Box flexDirection="column">{out}</Box>
  })
}
