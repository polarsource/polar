import { MONO } from '../sheet'
import {
  DEL,
  DIM,
  DOTTED,
  HAIR,
  LINE,
  MID,
  RULE,
  term,
  type TermTok,
} from '../kit'
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
  depth: number
  kind: string
  name: string
  from: number
  to: number
}[] = [
  { depth: 0, kind: 'customer', name: 'acme', from: 0, to: 12_750 },
  { depth: 1, kind: 'team', name: 'research', from: 0, to: 8_020 },
  { depth: 2, kind: 'person', name: 'ada@acme.io', from: 0, to: 1_900 },
  {
    depth: 2,
    kind: 'agent',
    name: 'research-bot',
    from: 1_900,
    to: 8_020,
  },
  { depth: 1, kind: 'agent', name: 'support-bot', from: 8_020, to: 11_500 },
  {
    depth: 1,
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
const INDENT = 12
const usageRowY = (i: number) => R_TOP + 32 + i * R_LH + (i === 0 ? 0 : 10)
const economicsRowY = (i: number) => R_TOP + 46 + i * R_LH + (i === 0 ? 0 : 10)

/** Each row's parent: the nearest row above it one level up. */
const parentOf = (i: number) => {
  for (let j = i - 1; j >= 0; j--)
    if (ROLLUP[j].depth === ROLLUP[i].depth - 1) return j
  return -1
}

/**
 * The tree's connectors, drawn rather than set in box-drawing glyphs so the verticals run unbroken: from each child a
 * stub left to its parent's line, which runs down from the parent, or the sibling above, to it.
 */
const treeLines = (rowY: (i: number) => number) =>
  ROLLUP.map((r, i) => {
    if (i === 0) return null
    const p = parentOf(i)
    const x = R_X0 + ROLLUP[p].depth * INDENT + 3
    const y = rowY(i) - 3
    let above = -1
    for (let j = i - 1; j > p; j--)
      if (parentOf(j) === p) {
        above = j
        break
      }
    const top =
      above >= 0 ? rowY(above) - 3 : p === 0 ? rowY(0) + 14 : rowY(p) + 3
    return (
      <path
        key={r.name}
        d={`M${x} ${top}V${y}H${x + INDENT - 5}`}
        fill="none"
        stroke={MID}
        strokeWidth={HAIR}
      />
    )
  })

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
    {treeLines(usageRowY)}
    {ROLLUP.map((r, i) => {
      const root = i === 0
      const y = usageRowY(i)
      return (
        <g key={r.name}>
          <text x={R_X0 + r.depth * INDENT} y={y} fill={LINE}>
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

/**
 * Unit economics down the same tree: each identity's revenue at the plan's price, what its usage cost to serve, and
 * the margin between them, with the floor drawn across the margin bars.
 */
const PRICE = 0.3
/** What serving each row's usage cost, in the order of `ROLLUP`. Parents are the sum of their children. */
const COST = [2_133, 1_640, 171, 1_469, 418, 75]
const FLOOR = 0.25
const E_REV = 300,
  E_COST = 360,
  E_PCT = 410,
  E_BAR = 424,
  E_BAR_W = 96
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

const economicsFigure = (
  <g style={{ ...MONO, letterSpacing: 0 }} fontSize={8}>
    <text x={R_X0} y={R_TOP} fill={DIM}>
      UNIT ECONOMICS · LAST 30 DAYS
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
    {(
      [
        [E_REV, 'REVENUE'],
        [E_COST, 'COST'],
        [E_PCT, 'MARGIN'],
      ] as const
    ).map(([x, t]) => (
      <text key={t} x={x} y={R_TOP + 26} fill={DIM} textAnchor="end">
        {t}
      </text>
    ))}
    {treeLines(economicsRowY)}
    {ROLLUP.map((r, i) => {
      const root = i === 0
      const y = economicsRowY(i)
      const revenue = (r.to - r.from) * PRICE
      const margin = (revenue - COST[i]) / revenue
      const under = margin < FLOOR
      return (
        <g key={r.name}>
          <text x={R_X0 + r.depth * INDENT} y={y} fill={LINE}>
            <tspan fill={DIM}>{r.kind} </tspan>
            {r.name}
          </text>
          <text x={E_REV} y={y} fill={LINE} textAnchor="end">
            {usd(revenue)}
          </text>
          <text x={E_COST} y={y} fill={DIM} textAnchor="end">
            {usd(COST[i])}
          </text>
          <text x={E_PCT} y={y} fill={under ? DEL : LINE} textAnchor="end">
            {Math.round(margin * 100)}%
          </text>
          <rect
            x={E_BAR}
            y={y - (root ? 5 : 4.5)}
            width={margin * E_BAR_W}
            height={root ? 4 : 3}
            fill={under ? DEL : root ? LINE : MID}
          />
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
    <line
      x1={E_BAR + FLOOR * E_BAR_W}
      x2={E_BAR + FLOOR * E_BAR_W}
      y1={R_TOP + 34}
      y2={R_TOP + 56 + (ROLLUP.length - 1) * R_LH + 14}
      stroke={DIM}
      strokeWidth={HAIR}
      {...DOTTED}
    />
    <text
      x={E_BAR + FLOOR * E_BAR_W}
      y={R_TOP + 56 + (ROLLUP.length - 1) * R_LH + 26}
      fill={DIM}
      textAnchor="middle"
    >
      FLOOR 25%
    </text>
  </g>
)

export const economics = landscape(
  'm-economics',
  'Unit economics',
  'Revenue, cost and margin for every identity in the tree.',
  'Thirty days of acme at $0.30 a credit: revenue, cost and margin for the customer and each identity beneath it, with margin drawn as a bar against a 25% floor. The research agent sits under it at 20%.',
  economicsFigure,
  [
    [
      'Per identity',
      [
        'Events carry their cost, and usage is priced as it lands, so every identity has its own revenue, cost and margin.',
      ],
    ],
    [
      'Where the margin goes',
      [
        'Rolled up, acme runs at a healthy 44%. One level down, research-bot runs at 20%, under the floor, while the people and services around it make up the difference.',
      ],
    ],
    [
      'Act on one identity',
      [
        'A guardrail on an agent’s margin can move it to a cheaper model or slow it down, and leave the rest of the customer alone.',
      ],
    ],
  ],
)
