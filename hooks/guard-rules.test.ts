import { test, expect } from 'claude-code/testing'
import { field, laneFor, normalize, parseResolve, parseWriteSet, rolesFor, within } from './guard-rules'

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

test('laneFor maps a brief to its models lane', () => {
  const b = (lane: string, role: string) => ({ runStem: 'fix-1-abcd', lane, role })
  expect(laneFor(b('review', 'code-reviewer'), '')).toBe('review')
  expect(laneFor(b('plan', 'planner'), '')).toBe('plan')
  expect(laneFor(b('fix', 'implementer'), 'Item: M1\nClass: trivial\n')).toBe('fix.implementer_trivial')
  expect(laneFor(b('fix', 'implementer'), 'Item: M1\n')).toBe('fix.implementer_standard')
  expect(laneFor(b('fix', 'code-reviewer'), 'Class: trivial\n')).toBe('fix.reviewer')
  expect(laneFor(b('patterns', 'pattern-scanner'), '')).toBeNull()
})

test('parseResolve reads subagent_type and model; rolesFor lists the roles config maps to a type', () => {
  expect(parseResolve('subagent_type: megamaid:planner\nmodel: opus\neffort: unset\nnative: yes\n')).toEqual({ subagentType: 'megamaid:planner', model: 'opus' })
  expect(parseResolve('model: opus\n')).toBeNull()
  const cfg = JSON.stringify({ agents: { planner: { subagent_type: 'megamaid:planner' }, b: { subagent_type: 'x' }, a: { subagent_type: 'x' } } })
  expect(rolesFor(cfg, 'x')).toEqual(['a', 'b'])
  expect(rolesFor(cfg, 'megamaid:implementer')).toEqual([])
  expect(rolesFor('not json', 'x')).toEqual([])
})
