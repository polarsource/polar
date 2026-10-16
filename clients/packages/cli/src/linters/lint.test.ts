import { describe, expect, test } from 'vitest'
import { lint } from '@/linters/lint'

const config = (file: string, lines: ReadonlyArray<string>) =>
  [file, lines.join('\n')] as const

const files = (entries: Record<string, ReadonlyArray<string>>) => {
  const sources = Object.fromEntries(
    Object.entries(entries).map(([file, lines]) => [file, lines.join('\n')]),
  )
  const [entry] = Object.keys(sources) as [string]
  return lint(entry, sources[entry]!, (file) => sources[file])
}

const brief = (issues: ReturnType<typeof lint>) =>
  issues.map((issue) => [issue.location?.line, issue.code, issue.message])

describe('lint', () => {
  test('warns about every read of the world outside the file, in source order', () => {
    const issues = lint(
      ...config('polar.config.ts', [
        "import { readFileSync } from 'node:fs'",
        'const launched = Date.now() > 1_700_000_000_000',
        "const name = process.env.PLAN_NAME ?? 'Pro'",
        'const id = Math.random().toString(36)',
        "const remote = await fetch('https://example.com/prices.json')",
        'export default { products: [] }',
      ]),
    )
    expect(issues).toEqual([
      {
        severity: 'warning',
        code: 'reads_filesystem',
        path: 'node:fs',
        message: 'Reads a file',
        location: { line: 1, column: 31, length: 7 },
      },
      {
        severity: 'error',
        code: 'reads_clock',
        path: 'Date.now',
        message: 'Reads the clock',
        location: { line: 2, column: 18, length: 9 },
      },
      {
        severity: 'warning',
        code: 'reads_environment',
        path: 'process.env',
        message: 'Reads an environment variable',
        location: { line: 3, column: 14, length: 11 },
      },
      {
        severity: 'error',
        code: 'reads_random',
        path: 'Math.random',
        message: 'Uses a random value',
        location: { line: 4, column: 12, length: 12 },
      },
      {
        severity: 'error',
        code: 'reads_network',
        path: 'fetch',
        message: 'Makes a network request',
        location: { line: 5, column: 22, length: 6 },
      },
    ])
  })

  test('reports each occurrence on a line', () => {
    const issues = lint(
      ...config('polar.config.js', ['const a = Date.now(), b = Date.now()']),
    )
    expect(issues.map((issue) => issue.location?.column)).toEqual([11, 27])
  })

  test('matches whole identifiers only', () => {
    const issues = lint(
      ...config('polar.config.ts', [
        'const when = Date()',
        'const later = new Date(2030, 0, 1)',
        'const prefetch = (url: string) => url',
        'const updateDate = (value: string) => value',
        'const name = readFileName',
      ]),
    )
    expect(brief(issues)).toEqual([
      [1, 'reads_clock', 'Reads the clock'],
      [2, 'reads_clock', 'Reads the clock'],
    ])
  })

  test('ignores strings and comments but not template expressions', () => {
    const issues = lint(
      ...config('polar.config.ts', [
        "const label = 'Updated with Date.now()'",
        'const note = "fetch(url) is not allowed"',
        'const fine = 1 // Math.random() would be bad',
        '/* Date.now() */ const also = 2',
        '/*',
        ' * fetch() in a block comment',
        ' */',
        '# process.env is not a comment marker here',
        'const stamp = `Plan ${Date.now()} ${"x"}`',
        'const url = `https://example.com/${Math.random()}`',
      ]),
    )
    expect(brief(issues)).toEqual([
      [8, 'reads_environment', 'Reads an environment variable'],
      [9, 'reads_clock', 'Reads the clock'],
      [10, 'reads_random', 'Uses a random value'],
    ])
  })

  test('mixes code and comments on one line', () => {
    const issues = lint(
      ...config('polar.config.ts', [
        '/* start */ const a = Date.now() /* end */',
        'const b = 1 /* open',
        'Math.random() still inside',
        'closes */ + Date.now()',
      ]),
    )
    expect(brief(issues)).toEqual([
      [1, 'reads_clock', 'Reads the clock'],
      [4, 'reads_clock', 'Reads the clock'],
    ])
  })

  test('honours polar-disable-next-line and polar-disable-line comments', () => {
    const issues = lint(
      ...config('polar.config.ts', [
        '// polar-disable-next-line',
        'const seed = Math.random()',
        'const name = process.env.NAME // polar-disable-line',
        '/* polar-disable-next-line reads_clock */',
        'const when = Date.now() + Math.random()',
        '// polar-disable-next-line reads_clock, reads_random',
        'const both = Date.now() + Math.random()',
        'const kept = Date.now()',
        "const text = 'polar-disable-next-line'",
        'const notDisabled = Math.random()',
      ]),
    )
    expect(issues.map((issue) => [issue.location?.line, issue.code])).toEqual([
      [5, 'reads_random'],
      [8, 'reads_clock'],
      [10, 'reads_random'],
    ])
  })

  test('follows relative imports and reports them at the import', () => {
    const issues = files({
      '/app/polar.config.ts': [
        "import { included } from './billing/prices'",
        "import { name } from './name.js'",
        "import { z } from 'zod'",
        "const lazy = await import('./lazy')",
        "const old = require('./old.cjs')",
        'export default { included, name }',
      ],
      '/app/billing/prices.ts': [
        "import { seed } from '../seed'",
        'export const included = seed > 0.5 ? 100 : 200',
      ],
      '/app/seed.ts': ['export const seed = Math.random()'],
      '/app/name.ts': ["export const name = process.env.NAME ?? 'Pro'"],
      '/app/lazy.ts': ['export const when = Date.now()'],
      '/app/old.cts': ["export const read = require('node:fs')"],
    })
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'reads_random',
        path: 'Math.random',
        message: 'Uses a random value in seed.ts:1',
        location: { line: 1, column: 27, length: 16 },
      },
      {
        severity: 'warning',
        code: 'reads_environment',
        path: 'process.env',
        message: 'Reads an environment variable in name.ts:1',
        location: { line: 2, column: 23, length: 9 },
      },
      {
        severity: 'error',
        code: 'reads_clock',
        path: 'Date.now',
        message: 'Reads the clock in lazy.ts:1',
        location: { line: 4, column: 28, length: 6 },
      },
      {
        severity: 'warning',
        code: 'reads_filesystem',
        path: 'node:fs',
        message: 'Reads a file in old.cts:1',
        location: { line: 5, column: 22, length: 9 },
      },
    ])
  })

  test('follows imports that span lines', () => {
    const issues = files({
      '/app/polar.config.ts': [
        'import {',
        '  included,',
        "} from './prices'",
        'const lazy = await import(',
        "  './lazy'",
        ')',
        'export default { included, lazy }',
      ],
      '/app/prices.ts': ['export const included = Math.random()'],
      '/app/lazy.ts': ['export const when = Date.now()'],
    })
    expect(brief(issues)).toEqual([
      [3, 'reads_random', 'Uses a random value in prices.ts:1'],
      [5, 'reads_clock', 'Reads the clock in lazy.ts:1'],
    ])
  })

  test('ignores text inside a multi-line template literal', () => {
    const issues = lint(
      ...config('polar.config.ts', [
        'const description = `',
        '  Prices refresh with Date.now() every hour',
        '  and ${Math.random()} is real code',
        '`',
        'export default { description }',
      ]),
    )
    expect(brief(issues)).toEqual([[3, 'reads_random', 'Uses a random value']])
  })

  test('lets a disable comment on the import or in the imported file silence it', () => {
    const issues = files({
      '/app/polar.config.ts': [
        "import { a } from './a' // polar-disable-line",
        "import { b } from './b'",
        'export default { a, b }',
      ],
      '/app/a.ts': ['export const a = Math.random()'],
      '/app/b.ts': [
        '// polar-disable-next-line',
        'export const b = Math.random()',
      ],
    })
    expect(issues).toEqual([])
  })

  test('reports a file once, at the first import that reaches it', () => {
    const issues = files({
      '/app/polar.config.ts': [
        "import { a } from './a'",
        "import { c } from './c'",
        'export default { a, c }',
      ],
      '/app/a.ts': ['export const a = Math.random()'],
      '/app/c.ts': ["import { a } from './a'", 'export const c = a'],
    })
    expect(issues.map((issue) => issue.location?.line)).toEqual([1])
  })

  test('has nothing to say about JSON', () => {
    const issues = lint(...config('polar.json', ['{ "name": "Date.now()" }']))
    expect(issues).toEqual([])
  })
})
