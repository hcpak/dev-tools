import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
}
const CONTEXT = 'todo: review draft\n#1 task https://x.test/1\n'

test('the band above the prompt shows the session, todos and pins', async ($, on) => {
  // Stands for the engine: an empty band, a home, a session and its context file.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.clock(on, { now: 0 })
  mock.env(on, { HOME: '/Users/me', CONTEXT_PANEL_PIN_LABEL: '두레이' })
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.read', (_$, e) =>
    e.path === '/Users/me/.claude/tasks/sess-1/.panel-context' ? { value: CONTEXT } : { deny: 'ENOENT' },
  )

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-pane', surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /^CONTEXT {2}할 일 1 {2}두레이 1 · sess-1 · \d\d:\d\d:\d\d$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /── 두레이 ──/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /review draft/ })).toBeDefined()
    expect(await ui.find({ type: 'Link', text: 'https://x.test/1' })).toBeDefined()
    await ui.unmount()
  }
})

test('the file section leaves out folders', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.clock(on, { now: 0 })
  mock.env(on, { HOME: '/Users/me' })
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.stat', (_$, e) => ({
    value: { kind: e.path.endsWith('/work') ? 'dir' : 'file', size: 1, mtimeMs: 0 },
  }))
  on('tool.call', () => ({ result: 'ok' }))
  await $.tool.call({ tool: 'Bash', command: 'cp ~/x.md ~/work && echo > ~/work/out.md' } as never)

  const ui = await $.ui.mount({ plugin: 'context-pane', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /파일 1/ })).toBeDefined()
  expect(await ui.find({ type: 'Link', text: /out\.md/ })).toBeDefined()
  await ui.unmount()
})

test('/ctx cycles the band: open, folded to the header line, hidden, open again', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.clock(on, { now: 0 })
  mock.env(on, { HOME: '/Users/me' })
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.read', () => ({ value: CONTEXT }))
  const mount = () => $.ui.mount({ plugin: 'context-pane', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  const said: (string | undefined)[] = []
  for (const expectVisible of [
    { header: true, rows: false },
    { header: false, rows: false },
    { header: true, rows: true },
  ]) {
    said.push((await $.command.run({ command: 'ctx', args: '' } as never)).text)
    const ui = await mount()
    expect((await ui.find({ type: 'Text', text: /^CONTEXT/ })) !== undefined).toBe(expectVisible.header)
    expect((await ui.find({ type: 'Text', text: /review draft/ })) !== undefined).toBe(expectVisible.rows)
    await ui.unmount()
  }
  expect(said).toEqual(['Context band folded.', 'Context band hidden.', 'Context band shown.'])
})

test('the fold button at the start of the header folds the band and opens it again', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.clock(on, { now: 0 })
  mock.env(on, { HOME: '/Users/me' })
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.read', () => ({ value: CONTEXT }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-pane', surface, component: 'AbovePrompt', props: BAND })
    expect((await ui.find({ key: 'fold' }))?.text).toBe('▾ 접기')

    await ui.press({ key: 'fold' })
    expect(await ui.find({ type: 'Text', text: /^CONTEXT/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /review draft/ })).toBeUndefined()
    expect((await ui.find({ key: 'fold' }))?.text).toBe('▸ 펼치기')

    await ui.press({ key: 'fold' })
    expect(await ui.find({ type: 'Text', text: /review draft/ })).toBeDefined()
    await ui.unmount()
  }
})

const PICK_CONTEXT = '#1 task https://x.test/1\ntodo: review draft\ntodo: send reply\n'
const ARCHIVE = '2026-10-20 09:00\ttodo: old one\n2026-10-27 17:41\t삭제\tdraft https://x.test/2\n'

// The band over a context file and its archive, with context-add answered from memory.
function pickBand($: Engine, on: On) {
  const runs: string[][] = []
  const files = { context: PICK_CONTEXT, archive: ARCHIVE }
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.clock(on, { now: 0 })
  mock.env(on, { HOME: '/Users/me' })
  on('session.id', () => ({ value: 'sess-1' }))
  on('fs.read', (_$, e) => ({ value: e.path.endsWith('.archive') ? files.archive : files.context }))
  on('process.run', (_$, e) => {
    runs.push([...(e as { argv: string[] }).argv.slice(1)])
    return { value: { exitCode: 0, stdout: 'ok\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const mount = () => $.ui.mount({ plugin: 'context-pane', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  return { runs, mount, files }
}

const buttons = async (ui: Pick<Mounted, 'findAll'>, prefix: string) =>
  (await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith(prefix))

test('a bare /done turns the band into a pick list of todos; a press finishes that one by its number', async ($, on) => {
  const { runs, mount } = pickBand($, on)

  await $.command.run({ command: 'done', args: '' } as never)
  const ui = await mount()
  expect(await ui.find({ type: 'Text', text: /할 일 고르기/ })).toBeDefined()
  expect(await buttons(ui, 'pick-')).toHaveLength(2)
  expect(await ui.find({ type: 'Text', text: /x\.test\/1/ })).toBeUndefined()

  await ui.press({ key: 'pick-3' })
  expect(runs.at(-1)).toEqual(['--done', '3'])
  await ui.unmount()
})

test('a bare /unpin picks among the pins and removes by number', async ($, on) => {
  const { runs, mount } = pickBand($, on)

  await $.command.run({ command: 'unpin', args: '' } as never)
  const ui = await mount()
  expect(await buttons(ui, 'pick-')).toHaveLength(1)

  await ui.press({ key: 'pick-1' })
  expect(runs.at(-1)).toEqual(['--rm', '1'])
  await ui.unmount()
})

test('the archive view lists removed lines newest first, and a press puts one back', async ($, on) => {
  const { runs, mount } = pickBand($, on)

  await $.command.run({ command: 'done', args: '' } as never)
  const ui = await mount()
  await ui.press({ key: 'archive' })
  const rows = await buttons(ui, 'restore-')
  expect(rows.map(r => r.text)).toEqual([expect.stringMatching(/10-27 17:41 삭제 .*draft/), expect.stringMatching(/10-20 09:00 밀려남 .*old one/)])

  // Keyed by the archive's own line, which only ever grows at the end.
  await ui.press({ key: 'restore-1' })
  expect(runs.at(-1)).toEqual(['--add', 'draft https://x.test/2'])
  await ui.press({ key: 'restore-0' })
  expect(runs.at(-1)).toEqual(['--todo', 'old one'])
  await ui.unmount()
})

test('닫기 leaves the pick list for the usual band', async ($, on) => {
  const { mount } = pickBand($, on)

  await $.command.run({ command: 'done', args: '' } as never)
  const ui = await mount()
  await ui.press({ key: 'close' })
  expect(await ui.find({ type: 'Text', text: /할 일 고르기/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /── 할 일 ──/ })).toBeDefined()
  await ui.unmount()
})

test('rows answer letter hotkeys, never digits: a bare digit in an empty prompt presses a band Button', async ($, on) => {
  const { mount } = pickBand($, on)

  await $.command.run({ command: 'done', args: '' } as never)
  const ui = await mount()
  expect((await buttons(ui, 'pick-')).map(b => b.props.hotkey)).toEqual(['a', 'b'])
  expect((await ui.find({ key: 'close' }))?.props.hotkey).toBe('x')
  expect((await ui.find({ key: 'archive' }))?.props.hotkey).toBe('z')
  await ui.press({ key: 'archive' })
  expect((await buttons(ui, 'restore-')).map(b => b.props.hotkey)).toEqual(['a', 'b'])
  await ui.unmount()
})

test('a press removes nothing when the line under that number changed since the list was drawn', async ($, on) => {
  const { runs, mount, files } = pickBand($, on)

  await $.command.run({ command: 'done', args: '' } as never)
  const ui = await mount()
  const before = runs.length
  files.context = '#1 task https://x.test/1\ntodo: send reply\n'
  await ui.press({ key: 'pick-3' })
  expect(runs.length).toBe(before)
  await ui.unmount()
})

test('/ctx while picking closes the pick list and leaves the band as it was', async ($, on) => {
  const { mount } = pickBand($, on)

  await $.command.run({ command: 'done', args: '' } as never)
  const said = await $.command.run({ command: 'ctx', args: '' } as never)
  const ui = await mount()
  expect(said.text).toBe('Pick list closed.')
  expect(await ui.find({ type: 'Text', text: /── 할 일 ──/ })).toBeDefined()
  await ui.unmount()
})
