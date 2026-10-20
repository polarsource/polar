import { MONO } from '../sheet'
import { DIM, HAIR, LINE, MID, RULE, term, type TermTok } from '../kit'
import { landscape } from './more'

/**
 * Identities sharing and passing down credits: one company's pool, a slice of it handed to each identity beneath, and
 * a run at the bottom that has used all of its own.
 */

const D = (t: string): TermTok => ({ t, tone: 'dim' })
const TREE: TermTok[][] = [
  [D('IDENTITY                    CREDITS        USED')],
  [{ t: 'acme                ' }, D('pool    '), { t: ' 10,000       3,680' }],
  [
    D('├ '),
    { t: 'research          ' },
    D('limit   '),
    { t: '  4,000       2,180' },
  ],
  [
    D('│ └ '),
    { t: 'agent           ' },
    D('budget  '),
    { t: '    500         480' },
  ],
  [
    D('└ '),
    { t: 'support-bot       ' },
    D('limit   '),
    { t: '  3,000       1,500' },
  ],
  [
    D('  └ '),
    { t: 'run_7f2         ' },
    D('cap     '),
    { t: '     50          ' },
    { t: '50', tone: 'del' },
  ],
  [],
  [{ t: 'signal', tone: 'del' }, { t: '  run_7f2 used its cap' }],
  [D('        → your app decides what happens next')],
]

const figure = (() => {
  const { line } = term(70, 165, 7.5, 14)
  return (
    <>
      {TREE.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>
  )
})()

export const delegation = landscape(
  'm-delegate',
  'Shared and delegated',
  'Credits and limits flow down the tree the way you set them.',
  'One company’s pool of 10,000 credits, a limit handed to a team and to an agent, a budget and a cap further down, and a run that has used all of its cap.',
  figure,
  [
    [
      'Shared',
      [
        'A company buys one pool of credits, and every identity beneath it draws from the same pool.',
      ],
    ],
    [
      'Delegated',
      [
        'Hand a slice down: a team gets a limit, an agent a budget, a single run a cap of its own. Usage still adds up to the pool.',
      ],
    ],
    [
      'Same guardrails',
      [
        'Each level can carry its own signals, so you hear about one run burning through its cap long before the company’s pool feels it.',
      ],
    ],
  ],
)

/**
 * Usage by identity, as a spend sheet: the customer's total on top, and the tree beneath it, each row's bar set inside
 * its parent's, so the rows under a node visibly add up to it.
 */
const ROLLUP: {
  branch: string
  kind: string
  name: string
  from: number
  to: number
}[] = [
  { branch: '', kind: 'customer', name: 'acme', from: 0, to: 12_750 },
  { branch: '├ ', kind: 'team', name: 'research', from: 0, to: 8_020 },
  { branch: '│ ├ ', kind: 'person', name: 'ada@acme.io', from: 0, to: 1_900 },
  {
    branch: '│ └ ',
    kind: 'agent',
    name: 'research-bot',
    from: 1_900,
    to: 8_020,
  },
  { branch: '├ ', kind: 'agent', name: 'support-bot', from: 8_020, to: 11_500 },
  {
    branch: '└ ',
    kind: 'service',
    name: 'nightly-sync',
    from: 11_500,
    to: 12_750,
  },
]
const R_X0 = 60,
  R_X1 = 520,
  R_TOP = 170,
  R_LH = 22
const BAR_X = 260,
  BAR_W = 140
const TOTAL = ROLLUP[0].to
const barX = (v: number) => BAR_X + (v / TOTAL) * BAR_W
const num = (v: number) => v.toLocaleString('en-US')

const rollupFigure = (
  <g style={{ ...MONO, letterSpacing: 0 }} fontSize={8}>
    <text x={R_X0} y={R_TOP} fill={DIM}>
      USAGE · LAST 30 DAYS
    </text>
    <text x={R_X1} y={R_TOP} fill={LINE} textAnchor="end">
      customer: acme
    </text>
    <line
      x1={R_X0}
      x2={R_X1}
      y1={R_TOP + 10}
      y2={R_TOP + 10}
      stroke={RULE}
      strokeWidth={HAIR}
    />
    {ROLLUP.map((r, i) => {
      const root = i === 0
      const y = R_TOP + 32 + i * R_LH + (root ? 0 : 10)
      return (
        <g key={r.name}>
          <text x={R_X0} y={y} fill={LINE}>
            <tspan fill={DIM}>{r.branch}</tspan>
            <tspan fill={DIM}>{r.kind} </tspan>
            {r.name}
          </text>
          <rect
            x={barX(r.from)}
            y={y - (root ? 5 : 4.5)}
            width={barX(r.to) - barX(r.from)}
            height={root ? 4 : 3}
            fill={root ? LINE : MID}
          />
          <text x={R_X1} y={y} fill={LINE} textAnchor="end">
            {num(r.to - r.from)} <tspan fill={DIM}>credits</tspan>
          </text>
          {root ? (
            <line
              x1={R_X0}
              x2={R_X1}
              y1={y + 11}
              y2={y + 11}
              stroke={RULE}
              strokeWidth={HAIR}
            />
          ) : null}
        </g>
      )
    })}
  </g>
)

export const rollup = landscape(
  'm-rollup',
  'Usage by identity',
  'Usage adds up the tree to whoever pays.',
  'Thirty days of usage for acme, as a spend sheet: the customer’s 12,750 credits on top, and beneath it the research team, its person and agent, the support agent and a nightly service, each bar set inside its parent’s.',
  rollupFigure,
  [
    [
      'Counted per identity',
      [
        'Each event names the identity that acted, so Polar counts usage for every person, agent and service under a customer.',
      ],
    ],
    [
      'Rolled up',
      [
        'A team’s usage is the sum of the people and agents in it, and the customer’s total is the sum of the whole tree.',
      ],
    ],
    [
      'One bill',
      [
        'The customer pays for the total, and the breakdown shows which agent or person it came from.',
      ],
    ],
  ],
)
