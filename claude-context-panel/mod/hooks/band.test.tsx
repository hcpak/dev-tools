import { expect, mock, test } from 'claude-code/testing'

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
