import { expect, test } from 'claude-code/testing'

import { linkify, listingFor, numberedContext, parseArchive, parseContext } from './parse'

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

test('each line keeps the number context-add takes for it, blank lines counted', () => {
  const ctx = numberedContext('#1 task https://x.test/1\n\ntodo: review\nnote /tmp/a.md\n  todo:  wait reply\n')
  expect(ctx.todos).toEqual([{ n: 3, text: 'review' }, { n: 5, text: 'wait reply' }])
  expect(ctx.pins).toEqual([{ n: 1, text: '#1 task https://x.test/1' }, { n: 4, text: 'note /tmp/a.md' }])
})

test('a listing keeps only the lines of one kind, with their numbers', () => {
  const listing = '1  #1 task https://x.test/1\n2  \n3  todo: review\n4  note /tmp/a.md\n'
  expect(listingFor('todo', listing)).toBe('3  todo: review')
  expect(listingFor('pin', listing)).toBe('1  #1 task https://x.test/1\n4  note /tmp/a.md')
  expect(listingFor('todo', '1  #1 task https://x.test/1\n')).toBe('(할 일 없음)')
  expect(listingFor('pin', '(컨텍스트 없음)')).toBe('(핀 없음)')
})

test('the archive reads newest first, and an old two-column line was pushed out by the cap', () => {
  const lines = parseArchive('2026-10-20 09:00\ttodo: old\n2026-10-27 17:40\t완료\ttodo: review\n2026-10-27 17:41\t삭제\tdraft https://x.test/2\n')
  expect(lines).toEqual([
    { line: 2, at: '2026-10-27 17:41', how: '삭제', todo: false, text: 'draft https://x.test/2' },
    { line: 1, at: '2026-10-27 17:40', how: '완료', todo: true, text: 'review' },
    { line: 0, at: '2026-10-20 09:00', how: '밀려남', todo: true, text: 'old' },
  ])
})

test('an old two-column archive line whose text holds a tab keeps the whole text', () => {
  expect(parseArchive('2026-10-20 09:00\t초안\t/tmp/x.md\n')).toEqual([
    { line: 0, at: '2026-10-20 09:00', how: '밀려남', todo: false, text: '초안\t/tmp/x.md' },
  ])
})
