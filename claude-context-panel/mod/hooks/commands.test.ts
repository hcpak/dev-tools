import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Run = { argv: readonly string[]; init?: { env?: Record<string, string> } }

// Stands for the bundled context-add: records each run and answers with `out`.
function fakeContextAdd(on: On, out = { exitCode: 0, stdout: 'ok\n', stderr: '' }) {
  const runs: Run[] = []
  on('session.id', () => ({ value: 'sess-1' }))
  on('process.run', (_$, e) => {
    runs.push(e as Run)
    return { value: { ...out, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return runs
}

const flags = (runs: Run[]) => runs.map(r => r.argv.slice(1))

test('/todo, /done, /pin and /unpin run context-add with the matching flag', async ($, on) => {
  const runs = fakeContextAdd(on)

  await $.command.run({ command: 'todo', args: 'review draft' } as never)
  await $.command.run({ command: 'done', args: '3' } as never)
  await $.command.run({ command: 'pin', args: '#1 task https://x.test/1' } as never)
  await $.command.run({ command: 'unpin', args: 'x.test' } as never)

  expect(flags(runs)).toEqual([
    ['--todo', 'review draft'],
    ['--done', '3'],
    ['--add', '#1 task https://x.test/1'],
    ['--rm', 'x.test'],
  ])
  for (const r of runs) {
    expect(r.argv[0]?.endsWith('/bin/context-add')).toBe(true)
    // context-add finds the session's file through this variable.
    expect(r.init?.env?.CLAUDE_CODE_SESSION_ID).toBe('sess-1')
  }
})

test('a bare /done lists only the todos, a bare /unpin only the pins, each by its number', async ($, on) => {
  const runs = fakeContextAdd(on, { exitCode: 0, stdout: '1  #1 task https://x.test/1\n2  todo: review draft\n', stderr: '' })

  // The number is what /done takes, so a pin in this list would be a number /done refuses.
  const done = await $.command.run({ command: 'done', args: '  ' } as never)
  const unpin = await $.command.run({ command: 'unpin', args: '' } as never)

  expect(flags(runs)).toEqual([[], []])
  expect(done.text).toBe('2  todo: review draft')
  expect(unpin.text).toBe('1  #1 task https://x.test/1')
})

test('what context-add refuses comes back as the command output', async ($, on) => {
  fakeContextAdd(on, { exitCode: 1, stdout: '', stderr: "찾지 못했습니다: 'nope' (할 일)\n" })

  const shown = await $.command.run({ command: 'done', args: 'nope' } as never)

  expect(shown.text).toContain('찾지 못했습니다')
})

const TOOL = 'mcp__context-pane__context_add'

test('the context_add tool maps each action to its flag', async ($, on) => {
  const runs = fakeContextAdd(on)

  for (const [action, text] of [['todo', 'a'], ['done', 'review'], ['pin', 'b'], ['unpin', 'c'], ['list', '']]) {
    const ran = await $.tool.call({ tool: TOOL, input: { action, text } })
    // The engine accepts only a string result for a plugin tool.
    expect(typeof (ran as { result?: unknown }).result).toBe('string')
  }

  expect(flags(runs)).toEqual([['--todo', 'a'], ['--done', 'review'], ['--add', 'b'], ['--rm', 'c'], []])
})

test('the context_add tool refuses an unknown action or missing text without running anything', async ($, on) => {
  const runs = fakeContextAdd(on)

  const unknown = await $.tool.call({ tool: TOOL, input: { action: 'clear', text: '' } })
  const empty = await $.tool.call({ tool: TOOL, input: { action: 'todo', text: ' ' } })

  expect(JSON.stringify(unknown)).toContain('isError')
  expect(JSON.stringify(empty)).toContain('isError')
  expect(runs).toEqual([])
})

test('a failed context-add run is an error result for the model', async ($, on) => {
  fakeContextAdd(on, { exitCode: 1, stdout: '', stderr: "'x' 이 2 개에 걸립니다\n" })

  const ran = await $.tool.call({ tool: TOOL, input: { action: 'unpin', text: 'x' } })

  expect(JSON.stringify(ran)).toContain('isError')
  expect(JSON.stringify(ran)).toContain('2 개에 걸립니다')
})

test('a live session passes the tool arguments at the top level, not under input', async ($, on) => {
  const runs = fakeContextAdd(on)

  const ran = await $.tool.call({ tool: TOOL, action: 'todo', text: 'reply due' } as never)

  expect(JSON.stringify(ran)).not.toContain('isError')
  expect(flags(runs)).toEqual([['--todo', 'reply due']])
})

test('text with a line break is refused before context-add runs', async ($, on) => {
  const runs = fakeContextAdd(on)

  const ran = await $.tool.call({ tool: TOOL, input: { action: 'done', text: 'nope\n\nalso nope' } })
  const shown = await $.command.run({ command: 'todo', args: 'one\ntodo: injected' } as never)

  expect(JSON.stringify(ran)).toContain('isError')
  expect(shown.text).toContain('line break')
  expect(runs).toEqual([])
})

test('an action named after an Object prototype key is refused', async ($, on) => {
  const runs = fakeContextAdd(on)

  const ran = await $.tool.call({ tool: TOOL, input: { action: 'constructor', text: 'x' } })

  expect(JSON.stringify(ran)).toContain('action must be one of')
  expect(runs).toEqual([])
})

test('when context-add cannot start, the reason reaches the command and the tool', async ($, on) => {
  on('session.id', () => ({ value: 'sess-1' }))
  // A deny is how the engine rejects the call, as when the file cannot be executed.
  on('process.run', () => ({ deny: 'EACCES' }))

  const shown = await $.command.run({ command: 'todo', args: 'x' } as never)
  const ran = await $.tool.call({ tool: TOOL, input: { action: 'pin', text: 'y' } })

  expect(shown.text).toContain('EACCES')
  expect(JSON.stringify(ran)).toContain('isError')
  expect(JSON.stringify(ran)).toContain('EACCES')
})

test('the context_add tool refuses to remove by number alone, since numbers shift after each removal', async ($, on) => {
  const runs = fakeContextAdd(on)

  const done = await $.tool.call({ tool: TOOL, input: { action: 'done', text: '2' } })
  const unpin = await $.tool.call({ tool: TOOL, input: { action: 'unpin', text: ' 4 ' } })

  expect(JSON.stringify(done)).toContain('isError')
  expect(JSON.stringify(unpin)).toContain('isError')
  expect(JSON.stringify(done)).toContain('text')
  expect(runs).toEqual([])
})

test('a todo or pin whose text is only a number is still added', async ($, on) => {
  const runs = fakeContextAdd(on)

  await $.tool.call({ tool: TOOL, input: { action: 'todo', text: '42' } })

  expect(flags(runs)).toEqual([['--todo', '42']])
})
