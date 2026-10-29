import { test, expect } from 'claude-code/testing'
import { field, normalize, parseWriteSet, within } from './guard-rules'

test('normalize collapses ., .., repeated and trailing slashes', () => {
  expect(normalize('/r/./a//b/../c/')).toBe('/r/a/c')
  expect(normalize('src/./x/')).toBe('src/x')
  expect(normalize('/')).toBe('/')
})

test('within: an entry is a file or a directory; a prefix sibling is outside', () => {
  expect(within('src/x/y.ts', ['src/x'])).toBe(true)
  expect(within('src/xy.ts', ['src/x'])).toBe(false)
  expect(within('src/a.ts', ['src/a.ts'])).toBe(true)
  expect(within('src/a.ts', [])).toBe(false)
})

test('field reads a shared-context line, null when absent', () => {
  expect(field('## 1. Shared context\n\nRepository: /r\nBranch: b\n', 'Repository')).toBe('/r')
  expect(field('Instruction file:  /r/p/M1-a.md  \n', 'Instruction file')).toBe('/r/p/M1-a.md')
  expect(field('no such line', 'Repository')).toBeNull()
})

test('parseWriteSet reads the write-set line', () => {
  expect(parseWriteSet('write-set: a b\n')).toEqual(['a', 'b'])
  expect(parseWriteSet('write-set: (none)\n')).toEqual([])
  expect(parseWriteSet('')).toBeNull()
})
