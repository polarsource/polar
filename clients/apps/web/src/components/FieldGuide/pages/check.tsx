import { MONO } from '../sheet'
import { LINE, DIM, BG, HAIR, DEL, term, type TermTok } from '../kit'
import { landscape } from './more'

/**
 * A margin check in CI: the pipeline a billing change runs through, stopped at the margin stage, and below it the
 * report that stopped it. Nothing after a failed stage runs.
 */

const X0 = 60,
  Y = 150
const BOX_W = 52,
  BOX_H = 22,
  GAP = 16
const STAGES: [string, 'pass' | 'fail' | 'skip'][] = [
  ['push', 'pass'],
  ['build', 'pass'],
  ['test', 'pass'],
  ['margin', 'fail'],
  ['apply', 'skip'],
]
const xOf = (i: number) => X0 + i * (BOX_W + GAP)
const FAILED = STAGES.findIndex(([, s]) => s === 'fail')

const label = (x: number, y: number, t: string, fill = DIM, size = 7.5) => (
  <text
    x={x}
    y={y}
    fontSize={size}
    fill={fill}
    textAnchor="middle"
    style={MONO}
  >
    {t}
  </text>
)

/** The report's value column, in characters, so the notes beside it start on one line. */
const VALUE_W = 21

const D = (t: string): TermTok => ({ t, tone: 'dim' })
const REPORT: TermTok[][] = [
  [
    { t: 'FAIL', tone: 'del' },
    { t: '  margin below the floor, nothing applied' },
  ],
  [],
  [D('plan      '), { t: 'pro' }],
  [D('meter     '), { t: 'output tokens' }],
  [D('price     '), { t: '$2.00 / M tokens' }],
  [
    D('cost      '),
    { t: '$2.36 / M tokens', w: VALUE_W },
    D('claude-opus-5-5'),
  ],
  [D('margin    '), { t: '-18%', tone: 'del', w: VALUE_W }, D('floor 20%')],
]

const figure = (() => {
  const { line } = term(X0, Y + 62, 7.5, 12)
  return (
    <>
      {STAGES.map(([name, state], i) => {
        const x = xOf(i)
        const stroke = state === 'fail' ? DEL : state === 'skip' ? DIM : LINE
        return (
          <g key={name}>
            {i > 0 ? (
              <line
                x1={xOf(i - 1) + BOX_W}
                x2={x}
                y1={Y + BOX_H / 2}
                y2={Y + BOX_H / 2}
                stroke={i > FAILED ? DIM : LINE}
                strokeWidth={HAIR}
              />
            ) : null}
            <rect
              x={x}
              y={Y}
              width={BOX_W}
              height={BOX_H}
              fill={BG}
              stroke={stroke}
              strokeWidth={HAIR}
            />
            {label(
              x + BOX_W / 2,
              Y + 13.5,
              name,
              state === 'skip' ? DIM : state === 'fail' ? DEL : LINE,
            )}
            {label(
              x + BOX_W / 2,
              Y + BOX_H + 12,
              state === 'pass' ? 'PASS' : state === 'fail' ? 'FAIL' : 'SKIPPED',
              state === 'fail' ? DEL : DIM,
              6.5,
            )}
          </g>
        )
      })}
      {REPORT.map((toks, i) =>
        toks.length ? line(i, 0, toks, `r${i}`) : null,
      )}
    </>
  )
})()

export const marginCheck = landscape(
  'm-check',
  'Margin checks',
  'An unprofitable price fails the build.',
  'A CI pipeline for a billing change: push, build and test pass, the margin check fails because the plan sells tokens for less than they cost, and apply never runs.',
  figure,
  [
    [
      'In CI',
      [
        'Polar runs in your pipeline next to your tests. Every change to the billing definition is priced against what it costs to serve before it can merge.',
      ],
    ],
    [
      'Price against cost',
      [
        'Events carry their cost, so Polar knows what a million tokens on each model costs you. Here, the plan charges $2.00 and serving it costs $2.36.',
      ],
    ],
    [
      'Blocked',
      [
        'That is 18% under water, below the 20% floor you set. The check fails and nothing is applied, the same as a failing test.',
      ],
    ],
  ],
)
