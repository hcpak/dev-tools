import { expect, test } from 'claude-code/testing'

import { handleForPane } from './orca'

const LIST = JSON.stringify({
  result: {
    terminals: [
      { handle: 'term_a', leafId: 'leaf-a' },
      { handle: 'term_b', leafId: 'leaf-b' },
    ],
  },
})

test('the pane key ends with the leaf id that names the terminal handle', () => {
  expect(handleForPane(LIST, 'tab-1:leaf-b')).toBe('term_b')
})

test('no pane key, an unknown leaf or unreadable output gives no handle', () => {
  expect(handleForPane(LIST, undefined)).toBeUndefined()
  expect(handleForPane(LIST, 'tab-1:leaf-z')).toBeUndefined()
  expect(handleForPane('not json', 'tab-1:leaf-a')).toBeUndefined()
})
