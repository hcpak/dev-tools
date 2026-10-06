import { expect, test } from 'claude-code/testing'

import { linkify, parseContext } from './parse'

test('todo: lines go to todos, everything else to pins', () => {
  const ctx = parseContext('#1 task https://x.test/1\ntodo: review — by 10/8\n\n  todo:  wait reply\n')
  expect(ctx.todos).toEqual(['review — by 10/8', 'wait reply'])
  expect(ctx.pins).toEqual(['#1 task https://x.test/1'])
})

test('URLs and absolute paths become links, the rest stays text', () => {
  expect(linkify('#4326 draft /private/tmp/a/draft.md and https://x.test/t/9')).toEqual([
    { text: '#4326 draft ' },
    { href: 'file:///private/tmp/a/draft.md', label: 'a/draft.md' },
    { text: ' and ' },
    { href: 'https://x.test/t/9', label: 'https://x.test/t/9' },
  ])
})

test('a slash inside a word is not a path', () => {
  expect(linkify('ok/fail 2/3')).toEqual([{ text: 'ok/fail 2/3' }])
})
