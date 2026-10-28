import { describe, expect, test } from 'vitest'
import { evaluateChecked, issuesFrom } from '@/linters/lint'

const stack = (frames: ReadonlyArray<string>) =>
  ['Error', '    at note (/app/node_modules/x/index.js:40:5)', ...frames].join(
    '\n',
  )

const files: Record<string, string> = {
  '/app/polar.config.ts': [
    "import { seatPrice } from './prices'",
    'export default {',
    '  // polar-disable-next-line',
    '  seed: Math.random(),',
    '  launched: Date.now() > 1_700_000_000_000,',
    "  name: process.env.NAME ?? 'Pro', // polar-disable-line",
    '}',
  ].join('\n'),
  '/app/prices.ts': [
    'export const seatPrice = () =>',
    '  Date.now() > 5 ? 19 : 29',
  ].join('\n'),
}

const read = (file: string) => files[file]

describe('issuesFrom', () => {
  test('locates the call in the config and names the root', () => {
    const issues = issuesFrom(
      '/app/polar.config.ts',
      [
        {
          rule: 'reads_clock',
          root: 'Date.now',
          stack: stack(['    at /app/polar.config.ts:5:18']),
        },
      ],
      read,
    )
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'reads_clock',
        path: 'Date.now',
        message: 'Reads the clock',
        location: { line: 5, column: 13, length: 8 },
      },
    ])
  })

  test('points at the first frame outside node_modules, in another file', () => {
    const issues = issuesFrom(
      '/app/polar.config.ts',
      [
        {
          rule: 'reads_clock',
          root: 'Date.now',
          stack: stack([
            '    at now (/app/node_modules/dayjs/index.js:10:3)',
            '    at seatPrice (/app/prices.ts:2:8)',
            '    at /app/polar.config.ts:2:21',
          ]),
        },
      ],
      read,
    )
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'reads_clock',
        path: 'prices.ts:2',
        message: 'Reads the clock',
      },
    ])
  })

  test('honours polar-disable-next-line and polar-disable-line', () => {
    const issues = issuesFrom(
      '/app/polar.config.ts',
      [
        {
          rule: 'reads_random',
          root: 'Math.random',
          stack: stack(['    at /app/polar.config.ts:4:14']),
        },
        {
          rule: 'reads_environment',
          root: 'process.env',
          stack: stack(['    at /app/polar.config.ts:6:17']),
        },
      ],
      read,
    )
    expect(issues).toEqual([])
  })

  test('reports one issue per rule and line', () => {
    const observation = {
      rule: 'reads_clock' as const,
      root: 'Date.now',
      stack: stack(['    at /app/polar.config.ts:5:18']),
    }
    expect(
      issuesFrom('/app/polar.config.ts', [observation, observation], read),
    ).toHaveLength(1)
  })
})

describe('evaluateChecked', () => {
  test('passes failures through when nothing was observed in user code', async () => {
    const { value, failure, issues } = await evaluateChecked(
      '/app/polar.config.ts',
      async () => {
        throw new Error('boom')
      },
    )
    expect(value).toBeUndefined()
    expect(failure).toBeInstanceOf(Error)
    expect(issues).toEqual([])
  })
})
