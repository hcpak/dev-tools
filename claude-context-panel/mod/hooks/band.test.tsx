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
