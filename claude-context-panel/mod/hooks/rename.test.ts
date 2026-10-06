import { expect, mock, test } from 'claude-code/testing'

const TOOL = 'mcp__context-pane__rename_session'

test('rename_session runs /rename with the title once the hook has returned', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const renamed: string[] = []
  on('command.run', { command: 'rename' }, (_$, e) => {
    renamed.push(e.args)
    return { text: 'renamed' }
  })

  const ran = await $.tool.call({ tool: TOOL, input: { title: '[Flowlog] 로그 절감 (#4059)' } })
  expect(JSON.stringify(ran)).toContain('[Flowlog] 로그 절감 (#4059)')
  // The engine accepts only a string result for a plugin tool.
  expect(typeof (ran as { result?: unknown }).result).toBe('string')
  await clock.advance(1000)
  expect(renamed).toEqual(['[Flowlog] 로그 절감 (#4059)'])
})

test('an empty title is refused and nothing is renamed', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const renamed: string[] = []
  on('command.run', { command: 'rename' }, (_$, e) => {
    renamed.push(e.args)
    return { text: 'renamed' }
  })

  const ran = await $.tool.call({ tool: TOOL, input: { title: '  ' } })
  expect(JSON.stringify(ran)).toContain('isError')
  await clock.advance(1000)
  expect(renamed).toEqual([])
})
