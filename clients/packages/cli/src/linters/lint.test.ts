import { describe, expect, test } from 'vitest'
import { compileExample, lint } from '@/linters/lint'

const check = (file: string, lines: ReadonlyArray<string>) =>
  lint(file, lines.join('\n'))

const brief = (issues: ReturnType<typeof lint>) =>
  issues.map((issue) => [issue.location?.line, issue.code, issue.severity])

describe('lint', () => {
  test('reports every read of the world outside the file, in source order', () => {
    const issues = check('polar.config.ts', [
      'const launched = Date.now() > 1_700_000_000_000',
      "const name = process.env.PLAN_NAME ?? 'Pro'",
      'const id = Math.random().toString(36)',
      "const remote = await fetch('https://example.com/prices.json')",
      "const local = readFileSync('prices.json')",
      'export default { products: [] }',
    ])
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'reads_clock',
        path: 'Date.now',
        message: 'Reads the clock',
        location: { line: 1, column: 18, length: 9 },
      },
      {
        severity: 'warning',
        code: 'reads_environment',
        path: 'process.env',
        message: 'Reads an environment variable',
        location: { line: 2, column: 14, length: 11 },
      },
      {
        severity: 'error',
        code: 'reads_random',
        path: 'Math.random',
        message: 'Uses a random value',
        location: { line: 3, column: 12, length: 12 },
      },
      {
        severity: 'error',
        code: 'reads_network',
        path: 'fetch',
        message: 'Makes a network request',
        location: { line: 4, column: 22, length: 6 },
      },
      {
        severity: 'warning',
        code: 'reads_filesystem',
        path: 'readFileSync',
        message: 'Reads a file',
        location: { line: 5, column: 15, length: 13 },
      },
    ])
  })

  test('reports each occurrence on a line, left to right', () => {
    const issues = check('polar.config.js', [
      'const a = Math.random(), b = Date.now()',
    ])
    expect(issues.map((issue) => [issue.location?.column, issue.code])).toEqual(
      [
        [11, 'reads_random'],
        [30, 'reads_clock'],
      ],
    )
  })

  test('matches whole identifiers, and only clock reads with no argument', () => {
    const issues = check('polar.config.ts', [
      'const when = Date()',
      'const now = new Date( )',
      'const fixed = new Date(2030, 0, 1)',
      "const launch = new Date('2026-11-01T00:00:00Z')",
      'const prefetch = (url: string) => url',
      'const updateDate = (value: string) => value',
      'const name = readFileName',
    ])
    expect(brief(issues)).toEqual([
      [1, 'reads_clock', 'error'],
      [2, 'reads_clock', 'error'],
    ])
  })

  test('ignores strings, comments and regex literals, but not template expressions', () => {
    const issues = check('polar.config.ts', [
      "const label = 'Updated with Date.now()'",
      'const note = "fetch(url) is not allowed"',
      'const fine = 1 // Math.random() would be bad',
      '/* Date.now() */ const also = 2',
      '/*',
      ' * fetch() in a block comment',
      ' */',
      'const isClock = (line: string) => /Date\\(\\)/.test(line)',
      'const stamp = `Plan ${Date.now()} ${"x"}`',
      'const nested = `${tier ? `Pro` : `Free`} ${Math.random()}`',
    ])
    expect(brief(issues)).toEqual([
      [9, 'reads_clock', 'error'],
      [10, 'reads_random', 'error'],
    ])
  })

  test('honours polar-disable-next-line and polar-disable-line', () => {
    const issues = check('polar.config.ts', [
      '// polar-disable-next-line',
      'const seed = Math.random()',
      'const name = process.env.NAME // polar-disable-line',
      '/* polar-disable-next-line -- the launch is scheduled */',
      'const launch = Date.now()',
      'const kept = Date.now()',
      "const text = 'polar-disable-next-line'",
      'const notDisabled = Math.random()',
    ])
    expect(issues.map((issue) => [issue.location?.line, issue.code])).toEqual([
      [6, 'reads_clock'],
      [8, 'reads_random'],
    ])
  })

  test('has nothing to say about JSON', () => {
    expect(check('polar.json', ['{ "name": "Date.now()" }'])).toEqual([])
  })
})

const matches = (example: string, code: string) =>
  [...code.matchAll(compileExample(example))].map((match) => match[0])

describe('compileExample', () => {
  test('a call with any arguments', () => {
    expect(matches('Date.now(...)', 'a = Date.now() + Date.now(1)')).toEqual([
      'Date.now(',
      'Date.now(',
    ])
    expect(matches('fetch(...)', "fetch('x'); prefetch('y')")).toEqual([
      'fetch(',
    ])
  })

  test('a call with no arguments, allowing whitespace and new', () => {
    expect(matches('Date()', 'Date() + new Date( ) + Date(1)')).toEqual([
      'Date()',
      'Date( )',
    ])
  })

  test('a bare reference, whole identifiers only', () => {
    expect(
      matches(
        'process.env',
        'process.env.X + myprocess.env + process.envelope',
      ),
    ).toEqual(['process.env'])
  })
})
