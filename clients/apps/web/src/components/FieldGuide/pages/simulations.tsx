import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, term, type TermTok } from '../kit'
import { landscape } from './more'

/**
 * Simulations: a branch of the billing definition, replayed over real usage, and merged back when it looks right.
 * The first page draws the branch; the second sets the comparison it produces as a table.
 */

const label = (
  x: number,
  y: number,
  t: string,
  anchor: 'start' | 'middle' | 'end' = 'start',
  fill = DIM,
) => (
  <text
    x={x}
    y={y}
    fontSize={7.5}
    fill={fill}
    textAnchor={anchor}
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

const X0 = 70,
  X1 = 390
const PROD = 214,
  BRANCH = 160,
  EVENTS = 278
const FORK = 150,
  MERGE = 330
/** Commits on production, and on the branch between its fork and its merge. */
const ON_PROD = [100, FORK, MERGE, 370]
const ON_BRANCH = [210, 270]

const node = (x: number, y: number, stroke = LINE) => (
  <circle
    key={`${x}-${y}`}
    cx={x}
    cy={y}
    r={3}
    fill={BG}
    stroke={stroke}
    strokeWidth={HAIR}
  />
)

const branch = (
  <>
    {label(X0 - 8, PROD + 2.5, 'PROD', 'end')}
    {label(X0 - 8, BRANCH + 2.5, 'BRANCHING', 'end')}
    <line
      x1={X0}
      x2={X1}
      y1={PROD}
      y2={PROD}
      stroke={LINE}
      strokeWidth={HAIR}
    />
    <path
      d={`M${FORK} ${PROD}C${FORK + 24} ${PROD} ${FORK + 16} ${BRANCH} ${FORK + 40} ${BRANCH}H${MERGE - 40}C${MERGE - 16} ${BRANCH} ${MERGE - 24} ${PROD} ${MERGE} ${PROD}`}
      fill="none"
      stroke={MID}
      strokeWidth={HAIR}
    />
    {label(FORK + 40, BRANCH - 10, 'pricing/opus-up', 'start', LINE)}
    {ON_PROD.map((x) => node(x, PROD))}
    {ON_BRANCH.map((x) => node(x, BRANCH, MID))}
    {label(MERGE, PROD + 16, 'DEPLOY', 'middle')}

    {label(X0 - 8, EVENTS + 2.5, 'EVENTS', 'end')}
    {Array.from({ length: 33 }, (_, i) => X0 + 4 + i * 9.6).map((x) => (
      <line
        key={x}
        x1={x}
        x2={x}
        y1={EVENTS - 3}
        y2={EVENTS + 3}
        stroke={MID}
        strokeWidth={HAIR}
      />
    ))}
    {label((X0 + X1) / 2, EVENTS + 18, 'LAST 30 DAYS · REAL USAGE', 'middle')}
  </>
)

export const branchReplay = landscape(
  'm-branch',
  'Branch and replay',
  'Try a new price on last month before your customers see it.',
  'Production as a line with the branch pricing/opus-up forking off it, last month of real events replayed up into the branch, and the branch merging back into production as a deploy.',
  branch,
  [
    [
      'A branch of your billing',
      [
        'Branch the billing definition the way you branch code: a new price, a different tier, a bigger credit grant. Production keeps running on the original.',
      ],
    ],
    [
      'Real usage, replayed',
      [
        'A simulation runs your real events from the last month through the branch, so you see what each customer would actually have paid.',
      ],
    ],
    [
      'Then deploy',
      [
        'When the numbers look right, merge the branch. It goes through the same plan, review and margin check as any other change.',
      ],
    ],
  ],
)

const D = (t: string): TermTok => ({ t, tone: 'dim' })
/** One grid for the whole page: a label column, then three value columns, every value set flush left. */
const COL = 12
const L = (t: string): TermTok => ({ t, tone: 'dim', w: COL })
const V = (t: string, tone?: TermTok['tone']): TermTok => ({ t, tone, w: COL })

const COMPARE: TermTok[][] = [
  [D('LEVERS')],
  [L('price'), { t: 'pro  $2.00 → $2.40 / M' }],
  [L('churn'), { t: '6%' }, D(' of customers who pay more')],
  [],
  [L(''), D('prod'.padEnd(COL)), D('opus-up'.padEnd(COL)), D('change')],
  [L('revenue'), V('$48,200'), V('$55,100'), V('+14%', 'add')],
  [L('cost'), V('$41,900'), V('$41,000'), V('-2%', 'dim')],
  [L('margin'), V('13%'), V('26%'), V('+13pt', 'add')],
  [],
  [
    { t: 'churn risk', tone: 'del', w: COL },
    { t: '312 customers pay 20% more' },
  ],
  [L(''), D('largest: acme, +$410 / month')],
]

const compare = (() => {
  const { line } = term(70, 150, 7.5, 14)
  return (
    <>
      {COMPARE.map((toks, i) =>
        toks.length ? line(i, 0, toks, `r${i}`) : null,
      )}
    </>
  )
})()

export const simulationCompare = landscape(
  'm-compare',
  'Levers and outcomes',
  'Pull a lever and see what last month would have looked like.',
  'A simulation of the pricing/opus-up branch: a price raised from $2.00 to $2.40 per million and 6% churn among customers who pay more, against production over the same month. Revenue up 14%, cost down 2%, margin from 13% to 26%, and a churn risk callout for the 312 customers whose bill goes up 20%.',
  compare,
  [
    [
      'Levers',
      [
        'Change what you want to test, a price, a tier, a grant, and the assumptions around it: how many affected customers churn, how fast new ones arrive.',
      ],
    ],
    [
      'Side by side',
      [
        'Revenue, cost and margin for production and the branch, from the same month of real events plus your assumptions.',
      ],
    ],
    [
      'Churn risk',
      [
        'Big price changes come flagged: how many customers would pay more, by how much, and the largest increases, before any of them see a new bill.',
      ],
    ],
  ],
)
