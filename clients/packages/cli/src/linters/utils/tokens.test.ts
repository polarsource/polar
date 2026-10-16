import { describe, expect, test } from 'vitest'
import { typescript } from '@/linters/typescript'
import { only, tokenize } from '@/linters/utils/tokens'

const spans = (text: string, open?: 'comment' | 'template') =>
  tokenize(text, typescript, open).spans.map(({ kind, text }) => [kind, text])

describe('tokenize', () => {
  test('splits a line into code, strings and comments', () => {
    expect(spans(`const a = 'x' + "y" // done`)).toEqual([
      ['code', 'const a = '],
      ['string', "'x'"],
      ['code', ' + '],
      ['string', '"y"'],
      ['code', ' '],
      ['comment', '// done'],
    ])
  })

  test('keeps escaped quotes inside a string', () => {
    expect(spans(String.raw`const a = 'it\'s' + 1`)).toEqual([
      ['code', 'const a = '],
      ['string', String.raw`'it\'s'`],
      ['code', ' + 1'],
    ])
  })

  test('runs an unterminated string to the end of the line', () => {
    expect(spans(`const a = "open`)).toEqual([
      ['code', 'const a = '],
      ['string', '"open'],
    ])
  })

  test('treats template expressions as code and the rest as string', () => {
    expect(spans('const s = `a ${b} c ${d()}`')).toEqual([
      ['code', 'const s = '],
      ['string', '`a '],
      ['code', '${b}'],
      ['string', ' c '],
      ['code', '${d()}'],
      ['string', '`'],
    ])
  })

  test('handles block comments inside a line', () => {
    expect(spans('a /* b */ c')).toEqual([
      ['code', 'a '],
      ['comment', '/* b */'],
      ['code', ' c'],
    ])
  })

  test('carries an open block comment to the next line', () => {
    const first = tokenize('a /* open', typescript, undefined)
    expect(first.open).toBe('comment')
    expect(first.spans).toEqual([
      { kind: 'code', text: 'a ' },
      { kind: 'comment', text: '/* open' },
    ])
    const middle = tokenize('still inside', typescript, 'comment')
    expect(middle.open).toBe('comment')
    expect(middle.spans).toEqual([{ kind: 'comment', text: 'still inside' }])
    const last = tokenize('closes */ b', typescript, 'comment')
    expect(last.open).toBeUndefined()
    expect(last.spans).toEqual([
      { kind: 'comment', text: 'closes */' },
      { kind: 'code', text: ' b' },
    ])
  })

  test('does not start a comment inside a string', () => {
    expect(spans(`const url = 'https://example.com' /* real */`)).toEqual([
      ['code', 'const url = '],
      ['string', "'https://example.com'"],
      ['code', ' '],
      ['comment', '/* real */'],
    ])
  })

  test('keeps a lone slash as code', () => {
    expect(spans('const half = a / 2')).toEqual([
      ['code', 'const half = a / 2'],
    ])
  })

  test('carries an open template literal to the next line', () => {
    const first = tokenize('const s = `start', typescript, undefined)
    expect(first.open).toBe('template')
    const middle = tokenize('Date.now() ${code} more', typescript, 'template')
    expect(middle.open).toBe('template')
    expect(middle.spans).toEqual([
      { kind: 'string', text: 'Date.now() ' },
      { kind: 'code', text: '${code}' },
      { kind: 'string', text: ' more' },
    ])
    const last = tokenize('end` + 1', typescript, 'template')
    expect(last.open).toBeUndefined()
    expect(last.spans).toEqual([
      { kind: 'string', text: 'end`' },
      { kind: 'code', text: ' + 1' },
    ])
  })

  test('treats regular expression literals as strings', () => {
    expect(spans('const re = /Date.now\\(\\)/g.test(x)')).toEqual([
      ['code', 'const re = '],
      ['string', '/Date.now\\(\\)/g'],
      ['code', '.test(x)'],
    ])
    expect(spans('const r = [/a\\/b/, /[/]c/i]')).toEqual([
      ['code', 'const r = ['],
      ['string', '/a\\/b/'],
      ['code', ', '],
      ['string', '/[/]c/i'],
      ['code', ']'],
    ])
    expect(spans('const n = total / count / 2')).toEqual([
      ['code', 'const n = total / count / 2'],
    ])
  })

  test('returns nothing for an empty line', () => {
    expect(tokenize('', typescript, undefined)).toEqual({
      spans: [],
      open: undefined,
    })
  })
})

describe('only', () => {
  const { spans: parts } = tokenize(
    `const a = 'x' // Date.now()`,
    typescript,
    undefined,
  )

  test('blanks the spans it drops and keeps columns stable', () => {
    expect(only(parts, (kind) => kind === 'code')).toBe(
      `const a =                  `,
    )
    expect(only(parts, (kind) => kind !== 'comment')).toBe(
      `const a = 'x'              `,
    )
    expect(only(parts, (kind) => kind === 'comment')).toBe(
      `              // Date.now()`,
    )
  })
})
