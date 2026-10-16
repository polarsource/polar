import { describe, expect, test } from 'vitest'
import { only, tokenizeJavaScript } from '@/linters/utils/tokens'

const lines = (source: string) =>
  tokenizeJavaScript(source).map((spans) =>
    spans.map(({ kind, text }) => [kind, text]),
  )

describe('tokenizeJavaScript', () => {
  test('splits a line into code, strings and comments', () => {
    expect(lines(`const a = 'x' + "y" // done`)).toEqual([
      [
        ['code', 'const a = '],
        ['string', "'x'"],
        ['code', ' + '],
        ['string', '"y"'],
        ['code', ' '],
        ['comment', '// done'],
      ],
    ])
  })

  test('keeps escaped quotes inside a string', () => {
    expect(lines(String.raw`const a = 'it\'s' + 1`)).toEqual([
      [
        ['code', 'const a = '],
        ['string', String.raw`'it\'s'`],
        ['code', ' + 1'],
      ],
    ])
  })

  test('treats template expressions as code and the rest as string', () => {
    expect(lines('const s = `a ${b} c ${d()}`')).toEqual([
      [
        ['code', 'const s = '],
        ['string', '`a ${'],
        ['code', 'b'],
        ['string', '} c ${'],
        ['code', 'd()'],
        ['string', '}`'],
      ],
    ])
  })

  test('follows a template literal nested inside an expression', () => {
    expect(lines('const s = `${a ? `x` : `y`} z`')).toEqual([
      [
        ['code', 'const s = '],
        ['string', '`${'],
        ['code', 'a ? '],
        ['string', '`x`'],
        ['code', ' : '],
        ['string', '`y`} z`'],
      ],
    ])
  })

  test('carries templates and block comments across lines', () => {
    expect(
      lines(
        [
          'const s = `start',
          'Date.now() ${code} end`',
          'a /* open',
          'closes */ b',
        ].join('\n'),
      ),
    ).toEqual([
      [
        ['code', 'const s = '],
        ['string', '`start'],
      ],
      [
        ['string', 'Date.now() ${'],
        ['code', 'code'],
        ['string', '} end`'],
      ],
      [
        ['code', 'a '],
        ['comment', '/* open'],
      ],
      [
        ['comment', 'closes */'],
        ['code', ' b'],
      ],
    ])
  })

  test('tells regular expression literals from division', () => {
    expect(lines('const re = /Date\\(\\)/g.test(x)')).toEqual([
      [
        ['code', 'const re = '],
        ['string', '/Date\\(\\)/g'],
        ['code', '.test(x)'],
      ],
    ])
    expect(lines('const f = () => /fetch\\(/.test(y)')[0]?.[1]).toEqual([
      'string',
      '/fetch\\(/',
    ])
    expect(lines('const n = total / count / 2')).toEqual([
      [['code', 'const n = total / count / 2']],
    ])
  })

  test('does not start a comment inside a string', () => {
    expect(lines(`const url = 'https://example.com' /* real */`)).toEqual([
      [
        ['code', 'const url = '],
        ['string', "'https://example.com'"],
        ['code', ' '],
        ['comment', '/* real */'],
      ],
    ])
  })

  test('returns one empty line for an empty source', () => {
    expect(tokenizeJavaScript('')).toEqual([[]])
  })
})

describe('only', () => {
  const [spans] = tokenizeJavaScript(`const a = 'x' // Date.now()`)

  test('fills the spans it drops and keeps columns stable', () => {
    expect(only(spans!, (kind) => kind === 'code')).toBe(
      `const a = ··· ·············`,
    )
    expect(only(spans!, (kind) => kind !== 'comment')).toBe(
      `const a = 'x' ·············`,
    )
    expect(only(spans!, (kind) => kind === 'comment')).toBe(
      `··············// Date.now()`,
    )
  })
})
