import { describe, expect, test } from 'claude-code/testing'

import { allocate, harvestCall, orderFiles } from './files'

const HOME = '/Users/me'

describe('harvestCall: which tool calls put a file on the list', () => {
  test('Write and Edit count as made, Read as only opened', () => {
    let list = harvestCall([], 'Write', { file_path: '/Users/me/w/a.md', content: 'see /Users/me/w/b.md' }, HOME)
    list = harvestCall(list, 'Read', { file_path: '/Users/me/w/c.md' }, HOME)
    expect(list).toEqual([
      { path: '/Users/me/w/a.md', made: true },
      { path: '/Users/me/w/c.md', made: false },
    ])
  })

  test('a shell command counts only when it writes something', () => {
    let list = harvestCall([], 'Bash', { command: 'cat /Users/me/w/read.md 2>/dev/null' }, HOME)
    expect(list).toEqual([])
    list = harvestCall(list, 'Bash', { command: 'echo hi > /Users/me/w/out.md' }, HOME)
    list = harvestCall(list, 'Bash', { command: 'chrome --screenshot=/Users/me/w/shot.png' }, HOME)
    list = harvestCall(list, 'Bash', { command: 'cp ~/w/x.md ~/w/한글.md' }, HOME)
    expect(list.map(f => f.path)).toEqual([
      '/Users/me/w/out.md',
      '/Users/me/w/shot.png',
      '/Users/me/w/x.md',
      '/Users/me/w/한글.md',
    ])
  })

  test('prose tools are never scanned', () => {
    expect(harvestCall([], 'Agent', { prompt: 'run: echo > /Users/me/w/a.md' }, HOME)).toEqual([])
  })

  test('paths outside home, in tool folders or repo furniture are left out', () => {
    const list = harvestCall([], 'Bash', {
      command: 'touch /tmp/a.md /Users/me/.claude/b.md /Users/me/bin/c /Users/me/w/README.md',
    }, HOME)
    expect(list).toEqual([])
  })

  test('a file mentioned again moves to the end and stays made once made', () => {
    let list = harvestCall([], 'Write', { file_path: '/Users/me/w/a.md' }, HOME)
    list = harvestCall(list, 'Write', { file_path: '/Users/me/w/b.md' }, HOME)
    list = harvestCall(list, 'Read', { file_path: '/Users/me/w/a.md' }, HOME)
    expect(list).toEqual([
      { path: '/Users/me/w/b.md', made: true },
      { path: '/Users/me/w/a.md', made: true },
    ])
  })
})

describe('orderFiles: what the file section shows', () => {
  test('newest first, grouped by folder, made before opened, missing files dropped', () => {
    const list = [
      { path: '/h/p/1.md', made: true },
      { path: '/h/q/2.md', made: true },
      { path: '/h/p/3.md', made: false },
      { path: '/h/p/gone.md', made: true },
      { path: '/h/p/4.md', made: true },
    ]
    const exists = new Set(['/h/p/1.md', '/h/q/2.md', '/h/p/3.md', '/h/p/4.md'])
    expect(orderFiles(list, exists).map(f => f.path)).toEqual([
      '/h/p/4.md', '/h/p/1.md', '/h/p/3.md', '/h/q/2.md',
    ])
  })

  test('keeps at most ten', () => {
    const list = Array.from({ length: 15 }, (_, i) => ({ path: `/h/${i}.md`, made: true }))
    expect(orderFiles(list, new Set(list.map(f => f.path)))).toHaveLength(10)
  })
})

describe('allocate: rows per section', () => {
  test('room for everything keeps every rule and item', () => {
    expect(allocate([2, 3, 1], 20)).toEqual({ rule: true, counts: [2, 3, 1] })
  })

  test('scarce rows drop the rules, keep one item each, fill in priority order', () => {
    expect(allocate([2, 5, 4], 6)).toEqual({ rule: false, counts: [2, 3, 1] })
  })

  test('too few rows drop the lowest-priority sections', () => {
    expect(allocate([2, 5, 4], 2)).toEqual({ rule: false, counts: [1, 1] })
  })
})
