import type { ReactNode } from 'react'
import { Sheet, MONO } from '../sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  FAINT,
  DOTTED,
  Guide,
  term,
  type TermTok,
  Callout,
  Figure,
  Anchor,
} from '../kit'
import type { Notes, Piece } from './index'

/** The remaining pages of the book: every section the contents promises, in the same hand as the first ones. */

const page = (
  id: string,
  title: string,
  note: string,
  w: number,
  h: number,
  cols: 1 | 2,
  render: () => ReactNode,
  text: Pick<Piece, 'sub' | 'notes'> = {},
): Piece => ({ id, title, kind: 'manual', note, w, h, cols, render, ...text })
const sheet = (w: number, h: number, title: string, children: ReactNode) => (
  <Sheet w={w} h={h} surface="night" unsigned title={title} pad={40}>
    {children}
  </Sheet>
)
const D = (t: string, w?: number): TermTok => ({ t, tone: 'dim', w })

/** A page with one figure, a line under its title, and notes beside it. */
export const landscape = (
  id: string,
  title: string,
  sub: string,
  note: string,
  figure: ReactNode,
  items: Notes,
) =>
  page(
    id,
    title,
    note,
    960,
    540,
    2,
    () =>
      sheet(
        960,
        540,
        title,
        <Figure x={40} y={156} w={620} h={300}>
          {figure}
        </Figure>,
      ),
    { sub, notes: items },
  )

// ---------------------------------------------------------------- 02 Events · Late events

const ingestion = (() => {
  const x0 = 70,
    x1 = 330,
    TOP = 186,
    BOT = 300
  const arrivals = [0.06, 0.2, 0.3, 0.52, 0.62, 0.84]
  const order = [1, 0, 2, 4, 3, 5]
  const slot = (k: number) => x0 + ((x1 - x0) * (k + 0.5)) / 6
  const fig = (
    <>
      <text x={x0} y={TOP - 26} fontSize={8} fill={DIM} style={MONO}>
        ARRIVED · BY INGESTION TIME
      </text>
      <line x1={x0} x2={x1} y1={TOP} y2={TOP} stroke={MID} strokeWidth={HAIR} />
      {arrivals.map((t, i) => (
        <g key={i}>
          <Anchor at={[x0 + (x1 - x0) * t, TOP]} />
          <text
            x={x0 + (x1 - x0) * t}
            y={TOP - 8}
            fontSize={7.5}
            fill={order[i] === 0 || order[i] === 3 ? LINE : DIM}
            textAnchor="middle"
            style={MONO}
          >
            e{order[i] + 1}
          </text>
        </g>
      ))}
      {arrivals.map((t, i) => {
        const ax = x0 + (x1 - x0) * t,
          bx = slot(order[i])
        const mid = (TOP + BOT) / 2
        const late = order[i] === 0 || order[i] === 3
        return (
          <path
            key={`p${i}`}
            d={`M${ax} ${TOP + 4} V${mid} H${bx} V${BOT - 12}`}
            fill="none"
            stroke={late ? LINE : DIM}
            strokeWidth={HAIR}
            {...(late ? {} : DOTTED)}
          />
        )
      })}
      <text x={x0} y={BOT + 42} fontSize={8} fill={DIM} style={MONO}>
        COUNTED · BY EVENT TIME
      </text>
      {Array.from({ length: 6 }, (_, k) => (
        <g key={k}>
          <rect
            x={slot(k) - 18}
            y={BOT - 12}
            width={36}
            height={16}
            fill={BG}
            stroke={k === 0 || k === 3 ? LINE : MID}
            strokeWidth={HAIR}
          />
          <text
            x={slot(k)}
            y={BOT - 1}
            fontSize={7.5}
            fill={k === 0 || k === 3 ? LINE : DIM}
            textAnchor="middle"
            style={MONO}
          >
            e{k + 1}
          </text>
        </g>
      ))}
      <line
        x1={x0}
        x2={x1}
        y1={BOT + 14}
        y2={BOT + 14}
        stroke={LINE}
        strokeWidth={HAIR}
      />
    </>
  )
  return landscape(
    'm-ingest',
    'Late events',
    'An event counts at the time it happened.',
    'Six events, in the order they arrived and the order they happened. The two that arrived late are drawn in ink, and each still counts at the time it happened.',
    fig,
    [
      [
        'Arrival',
        [
          'Events can arrive late: a retry, a queue that backed up, a batch sent at the end of a job. Each carries the time it happened, and Polar uses that time.',
        ],
      ],
      [
        'Same answer',
        [
          'A meter over the event log gives the same answer whether an event took a millisecond or a day to arrive. A late event slots into its place in time.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 03 Meters · Rates and tiers

const tiers = (() => {
  // One month's reading, 2.5M tokens, priced both ways over the same three tiers. The axis runs to 3M.
  const x0 = 70,
    x1 = 400
  const X = (m: number) => x0 + (m / 3) * (x1 - x0)
  const USAGE = 2.5
  const TOTAL = x1 + 24
  const HEAD = 150,
    GRAD = 186,
    VOL = 240,
    AXIS = 290,
    BAR = 20
  const t = (
    x: number,
    y: number,
    text: string,
    anchor: 'start' | 'middle' | 'end' = 'middle',
    fill = DIM,
  ) => (
    <text
      x={x}
      y={y}
      fontSize={7.5}
      fill={fill}
      textAnchor={anchor}
      style={MONO}
    >
      {text}
    </text>
  )
  const TIERS: [number, number, string, string][] = [
    [0, 1, 'TIER 1', '$3.00 / M'],
    [1, 2, 'TIER 2', '$2.50 / M'],
    [2, 3, 'TIER 3', '$2.00 / M'],
  ]
  // What each tier bills under graduated pricing: the tokens that fall in it, at its own rate.
  const graduated: [number, number, string, string][] = [
    [0, 1, '1M × $3', '$3.00'],
    [1, 2, '1M × $2.50', '$2.50'],
    [2, USAGE, '0.5M × $2', '$1.00'],
  ]
  const bar = (
    a: number,
    b: number,
    y: number,
    inside: string,
    under?: string,
  ) => (
    <g key={`${y}-${a}`}>
      <rect
        x={X(a)}
        y={y}
        width={X(b) - X(a)}
        height={BAR}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      {t((X(a) + X(b)) / 2, y + 12.5, inside, 'middle', LINE)}
      {under ? t((X(a) + X(b)) / 2, y + BAR + 12, `= ${under}`) : null}
    </g>
  )
  const fig = (
    <>
      {TIERS.map(([a, b, name, rate]) => (
        <g key={name}>
          {t((X(a) + X(b)) / 2, HEAD, name)}
          {t((X(a) + X(b)) / 2, HEAD + 12, rate, 'middle', LINE)}
        </g>
      ))}
      {[1, 2].map((m) => (
        <Guide key={m} a={[X(m), HEAD - 8]} b={[X(m), AXIS]} />
      ))}
      {t(TOTAL, HEAD + 12, 'TOTAL', 'start')}

      {t(x0 - 8, GRAD + 12.5, 'GRADUATED', 'end')}
      {graduated.map(([a, b, inside, under]) => bar(a, b, GRAD, inside, under))}
      {t(TOTAL, GRAD + 12.5, '$6.50', 'start', LINE)}

      {t(x0 - 8, VOL + 12.5, 'VOLUME', 'end')}
      {bar(0, USAGE, VOL, '2.5M × $2, all in tier 3')}
      {t(TOTAL, VOL + 12.5, '$5.00', 'start', LINE)}

      <line
        x1={x0}
        x2={x1}
        y1={AXIS}
        y2={AXIS}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {[0, 1, 2, 3].map((m) => (
        <g key={m}>
          <line
            x1={X(m)}
            x2={X(m)}
            y1={AXIS}
            y2={AXIS + 4}
            stroke={MID}
            strokeWidth={HAIR}
          />
          {t(X(m), AXIS + 15, m ? `${m}M` : '0')}
        </g>
      ))}
      <Guide a={[X(USAGE), GRAD + BAR]} b={[X(USAGE), AXIS]} />
      <Anchor at={[X(USAGE), AXIS]} />
      {t(X(USAGE), AXIS + 15, '2.5M', 'middle', LINE)}
      {t((x0 + x1) / 2, AXIS + 34, 'TOKENS THIS MONTH')}
    </>
  )
  return landscape(
    'm-tiers',
    'Rates and tiers',
    'One month of usage, priced two ways.',
    'A customer uses 2.5M tokens in a month. The same three tiers, $3, $2.50 and $2 per million, bill $6.50 when graduated and $5.00 by volume.',
    fig,
    [
      [
        'Tiers',
        [
          'A price splits the meter into ranges, each with its own rate. Here, the first million tokens cost $3 per million, the second $2.50, and everything after $2.',
        ],
      ],
      [
        'Graduated',
        [
          'Each tier bills the tokens that fall in it, at its own rate, like tax brackets. 2.5M tokens come to $3 + $2.50 + $1 = $6.50.',
        ],
      ],
      [
        'Volume',
        [
          'The tier the total lands in sets the rate for every token. 2.5M lands in tier 3, so all of it bills at $2: $5.00.',
        ],
      ],
      [
        'Declared',
        [
          'Tiers are declared in the config next to the meter they price, and a cap can bound the total.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 04 Local-first · Reconciliation

const reconciliation = (() => {
  const x0 = 70,
    x1 = 390
  const POLAR = 150,
    BASE = 290,
    BAND = 312
  // Events step Outpost's balance up as they land; Polar's snapshots settle it at three points along the way.
  const steps = [
    90, 108, 130, 158, 178, 196, 222, 246, 262, 288, 310, 336, 358, 378,
  ]
  const snapshots = [140, 205, 270]
  const rise = 5
  const level = (x: number) => BASE - steps.filter((s) => s <= x).length * rise
  const path = steps.reduce(
    (d, s, i) => `${d}H${s}V${BASE - (i + 1) * rise}`,
    `M${x0} ${BASE}`,
  )
  const last = snapshots[snapshots.length - 1]
  const label = (
    x: number,
    y: number,
    t: string,
    anchor: 'start' | 'middle' | 'end' = 'end',
  ) => (
    <text
      x={x}
      y={y}
      fontSize={7.5}
      fill={DIM}
      textAnchor={anchor}
      style={MONO}
    >
      {t}
    </text>
  )
  const fig = (
    <>
      {label(x0 - 8, POLAR + 2.5, 'POLAR')}
      <line
        x1={x0}
        x2={x1}
        y1={POLAR}
        y2={POLAR}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {label(x0 - 8, BASE + 2.5, 'OUTPOST')}
      <line
        x1={x0}
        x2={x1}
        y1={BASE}
        y2={BASE}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <path d={`${path}H${x1}`} fill="none" stroke={LINE} strokeWidth={HAIR} />

      {snapshots.map((x) => (
        <g key={x}>
          <Guide a={[x, POLAR + 3]} b={[x, level(x) - 3]} />
          <Anchor at={[x, POLAR]} />
          <Anchor at={[x, level(x)]} />
        </g>
      ))}
      {label(snapshots[0], POLAR - 10, 'SNAPSHOT', 'middle')}

      {/* the open part first, so the settled edge they share is drawn over it */}
      <rect
        x={last}
        y={BAND}
        width={x1 - last}
        height={8}
        fill={BG}
        stroke={FAINT}
        strokeWidth={HAIR}
      />
      <rect
        x={x0}
        y={BAND}
        width={last - x0}
        height={8}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      {label((x0 + last) / 2, BAND + 22, 'SETTLED · FROM POLAR', 'middle')}
      {label((last + x1) / 2, BAND + 22, 'LOCAL · OPEN BUCKETS', 'middle')}
    </>
  )
  return landscape(
    'm-reconcile',
    'Reconciliation',
    'Outpost answers now. Polar\u2019s snapshots correct it as buckets close.',
    'Outpost\u2019s balance as one step line, rising as events land, with Polar\u2019s snapshots settling it at points along the way: settled usage from Polar up to the latest snapshot, open local buckets after it.',
    fig,
    [
      [
        'Two folds',
        [
          'Outpost folds what your process has seen. Polar folds everything, including events from your other processes and events that arrived late.',
        ],
      ],
      [
        'Snapshots',
        [
          'When a bucket closes, a late event lands or credits change, Polar pushes a snapshot: the customer\u2019s settled usage up to a point in time. It replaces Outpost\u2019s totals before that point, and the local buckets behind it are dropped.',
        ],
      ],
      [
        'Never backwards',
        [
          'Every snapshot carries a version, and an older one is never applied over a newer one. If the connection drops, Outpost keeps answering from what it has and asks for fresh snapshots when it is back.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 05 Credits · Grants and expiry

const grants = (() => {
  const x0 = 60,
    x1 = 340,
    y = 230
  const fig = (
    <>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={MID} strokeWidth={HAIR} />
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <g key={i}>
          <line
            x1={x0 + (x1 - x0) * t}
            x2={x0 + (x1 - x0) * t}
            y1={y - 3}
            y2={y + 3}
            stroke={MID}
            strokeWidth={HAIR}
          />
          <text
            x={x0 + (x1 - x0) * t}
            y={y + 14}
            fontSize={7}
            fill={DIM}
            textAnchor="middle"
            style={MONO}
          >
            {['OCT', 'NOV', 'DEC', 'JAN', 'FEB'][i]}
          </text>
        </g>
      ))}
      {[
        [0, 0.75, '10,000 · EXPIRES JAN', y - 60, LINE],
        [0.25, 0.5, '2,000 · EXPIRES DEC', y - 36, MID],
        [0.5, 1, '5,000 · NO EXPIRY', y - 84, MID],
      ].map(([a, b, label, yy, col], i) => (
        <g key={i}>
          <line
            x1={x0 + (x1 - x0) * Number(a)}
            x2={x0 + (x1 - x0) * Number(b)}
            y1={Number(yy)}
            y2={Number(yy)}
            stroke={String(col)}
            strokeWidth={1.2}
          />
          <Anchor at={[x0 + (x1 - x0) * Number(a), Number(yy)]} />
          <line
            x1={x0 + (x1 - x0) * Number(b)}
            x2={x0 + (x1 - x0) * Number(b)}
            y1={Number(yy) - 4}
            y2={Number(yy) + 4}
            stroke={String(col)}
            strokeWidth={HAIR}
          />
          <text
            x={x0 + (x1 - x0) * Number(a) + 6}
            y={Number(yy) - 5}
            fontSize={7}
            fill={DIM}
            style={MONO}
          >
            {label}
          </text>
        </g>
      ))}
      <Callout
        at={[x0 + (x1 - x0) * 0.5, y - 36]}
        to={[x0 + (x1 - x0) * 0.5, y + 44]}
        route="v"
        dot={false}
        side="left"
      >
        EXPIRED · REMAINDER WRITTEN OFF
      </Callout>
    </>
  )
  return landscape(
    'm-grants',
    'Grants and expiry',
    'A grant is an event with a start and, sometimes, an end.',
    'Three grants on a timeline, each a bar from its start to its expiry: one still open, one expired, one without an end.',
    fig,
    [
      [
        'A grant',
        [
          'A grant adds credits from a moment, and may take them back at another.',
        ],
      ],
      [
        'Soonest first',
        [
          'Usage drains the grant that expires soonest first, so nothing is left to lapse while a longer one is spent.',
        ],
      ],
      [
        'Expiry',
        [
          'When a grant expires, its unused remainder is written off with an event of its own, and the balance is the fold over all of them.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 05 Credits · Running out

const zero = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [D('   TIME   EVENT                      CREDITS   BALANCE')],
    [{ t: '   09:41  llm.completion                -314     1,250' }],
    [{ t: '   09:52  llm.completion                -980       270' }],
    [
      {
        t: '   10:07  llm.completion                -412      -142',
        tone: 'del',
      },
    ],
    [{ t: '   10:07  ' }, { t: 'signal', tone: 'del' }, { t: '  balance < 0' }],
    [D('          → your app decides what happens next')],
    [],
    [
      { t: '   10:31  ' },
      { t: 'credit.granted', tone: 'add' },
      { t: '              +5,000     4,858' },
    ],
  ]
  return landscape(
    'm-zero',
    'Running out',
    'Polar keeps counting. What happens next is up to you.',
    'A customer’s credits running out: the request that takes the balance to -142, a signal to the app, then a top-up of 5,000 that settles the 142 owed.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'Never refused',
        [
          'Polar records every event, even the one that takes the balance under zero. The balance goes negative, here to -142.',
        ],
      ],
      [
        'Your call',
        [
          'Polar does not cut anyone off. What happens at zero is up to your app: block the request, move the customer to a cheaper model, or let them run a tab. A guardrail at zero tells you when it happens.',
        ],
      ],
      [
        'Topping up',
        [
          'A new grant is added to the balance as it stands, so the 142 owed comes off first: 5,000 credits leave 4,858.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 06 Entitlements · On a product

const entitlements = (() => {
  const x0 = 103,
    y0 = 160
  const rows: [string, string][] = [
    ['api', 'ACCESS'],
    ['credits', '10,000 / MONTH'],
    ['license', 'KEY · 1 SEAT'],
  ]
  const fig = (
    <>
      <rect
        x={x0}
        y={y0}
        width={80}
        height={24}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <text
        x={x0 + 40}
        y={y0 + 10}
        fontSize={7}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        PRODUCT
      </text>
      <text
        x={x0 + 40}
        y={y0 + 19}
        fontSize={7.5}
        fill={LINE}
        textAnchor="middle"
        style={MONO}
      >
        pro
      </text>
      <line
        x1={x0 + 40}
        x2={x0 + 40}
        y1={y0 + 24}
        y2={y0 + 48}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <line
        x1={x0 + 40}
        x2={x0 + 40 + (rows.length - 1) * 66}
        y1={y0 + 48}
        y2={y0 + 48}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {rows.map(([name, kind], i) => {
        const x = x0 + 40 + i * 66
        return (
          <g key={name}>
            <line
              x1={x}
              x2={x}
              y1={y0 + 48}
              y2={y0 + 64}
              stroke={MID}
              strokeWidth={HAIR}
            />
            <rect
              x={x - 28}
              y={y0 + 64}
              width={56}
              height={20}
              fill={BG}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <text
              x={x}
              y={y0 + 77}
              fontSize={7.5}
              fill={LINE}
              textAnchor="middle"
              style={MONO}
            >
              {name}
            </text>
            <text
              x={x}
              y={y0 + 98}
              fontSize={6.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              {kind}
            </text>
          </g>
        )
      })}
      <Callout
        at={[x0 + 40, y0 + 36]}
        to={[x0 + 40 - 28, y0 + 36]}
        side="left"
        dot={false}
      >
        GRANTS, ON SUBSCRIPTION
      </Callout>
    </>
  )
  return landscape(
    'm-entitlements',
    'On a product',
    'What a product grants, held by the customer while they subscribe.',
    'A product and the three entitlements it grants: API access, 10,000 credits a month and a license key. Each is granted when the subscription is active.',
    fig,
    [
      [
        'Templates',
        [
          'A product lists what it grants: access to the API, a monthly grant of credits, a license key. Each is a template the customer gets a copy of.',
        ],
      ],
      [
        'Granted',
        [
          'When a subscription to the product becomes active, every entitlement on it is granted to the customer, and revoked again when the subscription ends.',
        ],
      ],
      [
        'Changes',
        [
          'Change the product’s entitlements in the file, and the next apply updates them.',
        ],
      ],
    ],
  )
})()

export const more: Piece[] = [
  ingestion,
  tiers,
  reconciliation,
  grants,
  zero,
  entitlements,
]
