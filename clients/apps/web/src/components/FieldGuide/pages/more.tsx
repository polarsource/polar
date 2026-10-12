import type { ReactNode } from 'react'
import { Sheet, MONO } from '../sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  DOTTED,
  Guide,
  TITLE,
  TEXT,
  term,
  type TermTok,
  Sections,
  Callout,
  Figure,
  PageHead,
  Body,
  Anchor,
  Hatch,
} from '../kit'
import type { Piece } from './index'

/** The remaining pages of the book: every section the contents promises, in the same hand as the first ones. */

const page = (
  id: string,
  title: string,
  note: string,
  w: number,
  h: number,
  cols: 1 | 2,
  render: () => ReactNode,
): Piece => ({ id, title, kind: 'manual', note, w, h, cols, render })
const sheet = (w: number, h: number, title: string, children: ReactNode) => (
  <Sheet w={w} h={h} surface="night" unsigned title={title} pad={40}>
    {children}
  </Sheet>
)
const D = (t: string, w?: number): TermTok => ({ t, tone: 'dim', w })

/** A page with one paragraph: head, the figure centred, the paragraph right, a folio. */
const portrait = (
  id: string,
  crumb: string,
  title: string,
  sub: string,
  n: string,
  folio: string,
  note: string,
  figure: ReactNode,
  text: string[],
) =>
  page(id, title, note, 960, 540, 2, () =>
    sheet(
      960,
      540,
      title,
      <>
        <PageHead crumb={crumb} w={960} pad={40} title={title} sub={sub} />
        <Figure x={40} y={156} w={620} h={300} dy={26} n={n}>
          <g transform="translate(138 22)">{figure}</g>
        </Figure>
        <Body x={700} y={176} width={220} size={11.5} text={text} />
      </>,
    ),
  )

/** A landscape page: head, one figure left, sections right, a folio. */
const landscape = (
  id: string,
  crumb: string,
  title: string,
  sub: string,
  n: string,
  folio: string,
  note: string,
  figure: ReactNode,
  items: [string, string[]][],
) =>
  page(id, title, note, 960, 540, 2, () =>
    sheet(
      960,
      540,
      title,
      <>
        <PageHead crumb={crumb} w={960} pad={40} title={title} sub={sub} />
        <Figure x={40} y={156} w={620} h={300} dy={26} n={n}>
          {figure}
        </Figure>
        <Sections x={700} y={176} width={220} size={11} items={items} />
      </>,
    ),
  )

// ---------------------------------------------------------------- 01 Billing as code · Environments

const environments = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [{ t: '$ ' }, { t: 'polar env list' }],
    [],
    [D('NAME     '), D('CONFIG          '), D('APPLIED            '), D('BY')],
    [
      { t: 'prod     ' },
      { t: 'a41f2c0        ' },
      D('2026-10-07 09:41   '),
      D('ada'),
    ],
    [
      { t: 'staging  ' },
      { t: 'c9e8b17        ' },
      D('2026-10-10 14:02   '),
      D('ci'),
    ],
    [
      { t: 'dev      ' },
      { t: 'c9e8b17        ' },
      D('2026-10-10 14:02   '),
      D('ci'),
    ],
    [],
    [{ t: '$ ' }, { t: 'polar diff' }, D(' --from staging --to prod')],
    [],
    [
      { t: '  ' },
      { t: '-  price    pro.tokens    perMillion(usd(3))', tone: 'del' },
    ],
    [
      { t: '  ' },
      { t: '+  price    pro.tokens    perMillion(usd(2.5))', tone: 'add' },
    ],
    [
      { t: '  ' },
      {
        t: '+  product  team          seats · graduated · monthly',
        tone: 'add',
      },
    ],
    [],
    [D('staging is 2 changes ahead of prod')],
    [],
    [{ t: '$ ' }, { t: 'polar promote' }, D(' staging prod')],
    [{ t: '✓ ' }, { t: 'prod is now at c9e8b17' }],
  ]
  return landscape(
    'm-env',
    '01 · BILLING AS CODE · ENVIRONMENTS',
    'Environments',
    'One file, three deployments. Promotion is a diff, not a copy.',
    '00c',
    '8',
    'Three environments running the same config at different commits, the diff between two of them, and a promotion.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'ONE FILE',
        [
          'Every environment runs the same config at some commit. There is no separate staging file to drift; staging is prod a few commits ahead.',
        ],
      ],
      [
        'THE DIFF',
        [
          'Because each environment is a fold over its applied events, the difference between two of them is a diff of config, readable before it is promoted.',
        ],
      ],
      [
        'PROMOTE',
        [
          'Promotion applies the events staging already has to prod. Nothing is re-entered, and the commit tells you exactly what moved.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 02 Events · Ingestion and ordering

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
        ARRIVED · BY WALL CLOCK
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
        LEDGER · BY EVENT TIME
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
  return portrait(
    'm-ingest',
    '02 · EVENTS · INGESTION AND ORDERING',
    'Ingestion and ordering',
    'Events arrive out of order. The ledger keeps them in it.',
    '001c',
    '14',
    'Six events arrive in one order and are placed in another: the ledger orders by the time the event happened, not the time it landed. The two that arrived late are drawn in ink.',
    fig,
    [
      'Events arrive late, early and in bursts. Each carries the time it happened, and the ledger orders by that, not by arrival. A fold over the ledger therefore gives the same answer whether an event took a millisecond or a day to arrive, and a late event slots into its place rather than onto the end.',
    ],
  )
})()

// ---------------------------------------------------------------- 02 Events · Replay

const replay = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [
      { t: '$ ' },
      { t: 'polar replay' },
      D(' --meter tokens --from 2026-10-01 --to 2026-10-31'),
    ],
    [],
    [
      D('Reading   '),
      { t: '5,015,338 events' },
      D('  2026-10-01 → 2026-10-31'),
    ],
    [D('Folding   '), { t: 'tokens' }, D('  sum(tokens) on llm.completion')],
    [],
    [D('   DAY         EVENTS      TOKENS      BALANCE')],
    [{ t: '   10-01       161,204   1,204,318   1,204,318' }],
    [{ t: '   10-02       158,990   1,188,002   2,392,320' }],
    [D('   …')],
    [{ t: '   10-31       171,380   1,301,114  38,210,906' }],
    [],
    [
      { t: '✓ ' },
      { t: 'tokens = 38,210,906' },
      D('  identical to the stored reading'),
    ],
    [D('  state = fn(events)')],
  ]
  return landscape(
    'm-replay',
    '02 · EVENTS · REPLAY',
    'Replay',
    'Run the fold again and you get the same number. That is the test.',
    '001d',
    '16',
    'A replay of one meter over one month: every event folded again from the ledger, and the result checked against the stored reading.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'WHY REPLAY',
        [
          'A number is trustworthy if it can be recomputed. Replay runs the fold over the ledger from scratch and compares it with the reading on hand.',
        ],
      ],
      [
        'WHAT IT CATCHES',
        [
          'A fold that changed, an event that was mis-ordered, a reading that drifted. If replay and reading agree, the number is the events; if not, the events win.',
        ],
      ],
      [
        'WHEN',
        [
          'At the close of every period, before an invoice is issued, and any time a meter’s definition changes.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 03 Meters · Rates and tiers

const tiers = (() => {
  const x0 = 70,
    x1 = 330,
    y0 = 150,
    h = 170
  const steps: [number, number, string][] = [
    [0, 0.33, '$3 / M'],
    [0.33, 0.66, '$2.5 / M'],
    [0.66, 1, '$2 / M'],
  ]
  const fig = (
    <>
      <line
        x1={x0}
        x2={x1}
        y1={y0 + h}
        y2={y0 + h}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <line
        x1={x0}
        x2={x0}
        y1={y0}
        y2={y0 + h}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {steps.map(([a, b, label], i) => {
        const yy = y0 + h - h * (0.9 - i * 0.25)
        return (
          <g key={label}>
            <line
              x1={x0 + (x1 - x0) * a}
              x2={x0 + (x1 - x0) * b}
              y1={yy}
              y2={yy}
              stroke={LINE}
              strokeWidth={1.2}
            />
            {i > 0 ? (
              <Guide
                a={[x0 + (x1 - x0) * a, yy]}
                b={[x0 + (x1 - x0) * a, y0 + h - h * (0.9 - (i - 1) * 0.25)]}
              />
            ) : null}
            <text
              x={x0 + ((x1 - x0) * (a + b)) / 2}
              y={yy - 6}
              fontSize={7.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              {label}
            </text>
            <Anchor at={[x0 + (x1 - x0) * a, yy]} />
          </g>
        )
      })}
      {[0, 0.33, 0.66, 1].map((t, i) => (
        <text
          key={i}
          x={x0 + (x1 - x0) * t}
          y={y0 + h + 14}
          fontSize={7}
          fill={DIM}
          textAnchor="middle"
          style={MONO}
        >
          {['0', '1M', '2M', '∞'][i]}
        </text>
      ))}
      <text
        x={x1}
        y={y0 + h + 28}
        fontSize={7.5}
        fill={DIM}
        textAnchor="end"
        style={MONO}
      >
        TOKENS
      </text>
      <text
        x={x0 - 6}
        y={y0 + 4}
        fontSize={7.5}
        fill={DIM}
        textAnchor="end"
        style={MONO}
      >
        RATE
      </text>
      <Callout
        at={[x0 + (x1 - x0) * 0.5, y0 + h - h * 0.65]}
        to={[x0 + (x1 - x0) * 0.5, y0 + h + 54]}
        route="v"
        dot={false}
      >
        GRADUATED · A RATE PER TIER
      </Callout>
    </>
  )
  return portrait(
    'm-tiers',
    '03 · METERS · RATES AND TIERS',
    'Rates and tiers',
    'A rate is a function of the reading; tiers make it a step.',
    '002b',
    '22',
    'A graduated price: three tiers, each with its own rate per million, drawn as a step function over the meter.',
    fig,
    [
      'A price is a function of a reading. Flat means one rate throughout. Graduated means each tier is charged at its own rate, so the first million costs more than the third. Volume means the tier the total lands in sets the rate for all of it. Tiers are declared in the config next to the meter they price, and a cap bounds the sum.',
    ],
  )
})()

// ---------------------------------------------------------------- 03 Meters · Reconciliation

const reconciliation = (() => {
  const x0 = 60,
    x1 = 340
  const LOCAL = 190,
    LEDGER = 290
  const fig = (
    <>
      {[
        ['LOCAL', LOCAL],
        ['LEDGER', LEDGER],
      ].map(([l, y]) => (
        <g key={String(l)}>
          <text
            x={x0 - 8}
            y={Number(y) + 2.5}
            fontSize={7.5}
            fill={DIM}
            textAnchor="end"
            style={MONO}
          >
            {l}
          </text>
          <line
            x1={x0}
            x2={x1}
            y1={Number(y)}
            y2={Number(y)}
            stroke={MID}
            strokeWidth={HAIR}
          />
        </g>
      ))}
      <path
        d={`M${x0} ${LOCAL} H${x0 + 70} V${LOCAL - 10} H${x0 + 150} V${LOCAL - 20} H${x0 + 210} V${LOCAL - 36} H${x1}`}
        fill="none"
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <path
        d={`M${x0} ${LEDGER} H${x0 + 70} V${LEDGER - 10} H${x0 + 120} V${LEDGER - 20} H${x0 + 150} V${LEDGER - 26} H${x0 + 210} V${LEDGER - 36} H${x1}`}
        fill="none"
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <Guide a={[x0 + 120, LEDGER - 20]} b={[x0 + 120, LOCAL - 10]} />
      <Anchor at={[x0 + 120, LEDGER - 20]} />
      <Anchor at={[x0 + 210, LOCAL - 36]} />
      <Anchor at={[x0 + 210, LEDGER - 36]} />
      <Callout
        at={[x0 + 120, LOCAL - 10]}
        to={[x0 + 120, 134]}
        route="v"
        dot={false}
        side="left"
      >
        A LATE EVENT, MISSED LOCALLY
      </Callout>
      <Callout
        at={[x0 + 210, LEDGER - 36]}
        to={[x0 + 210, 320]}
        route="v"
        side="left"
      >
        RECONCILED · LOCAL = LEDGER
      </Callout>
    </>
  )
  return portrait(
    'm-reconcile',
    '03 · METERS · RECONCILIATION',
    'Reconciliation',
    'The local fold answers now; the ledger corrects it later.',
    '002c',
    '24',
    'Two step lines: the local state, folded as events are seen, and the ledger, folded in event order. A late event puts them out of step until reconciliation brings them back together.',
    fig,
    [
      'A local fold answers from what it has seen. The ledger folds in event order, including what arrived late. The two can differ for a while, and that is allowed: a check is answered from the local fold at once, and at the next reconciliation the local state is replaced by the ledger’s. Nothing is lost, because the events are still there.',
    ],
  )
})()

// ---------------------------------------------------------------- 04 Credits · Grants and expiry

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
          {Number(b) < 1 ? (
            <line
              x1={x0 + (x1 - x0) * Number(b)}
              x2={x0 + (x1 - x0) * Number(b)}
              y1={Number(yy) - 4}
              y2={Number(yy) + 4}
              stroke={String(col)}
              strokeWidth={HAIR}
            />
          ) : null}
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
      <Guide
        a={[x0 + (x1 - x0) * 0.6, y - 100]}
        b={[x0 + (x1 - x0) * 0.6, y + 24]}
      />
      <text
        x={x0 + (x1 - x0) * 0.6}
        y={y - 106}
        fontSize={7}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        NOW
      </text>
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
  return portrait(
    'm-grants',
    '04 · CREDITS · GRANTS AND EXPIRY',
    'Grants and expiry',
    'A grant is an event with a start and, sometimes, an end.',
    '003b',
    '30',
    'Three grants on a timeline, each a bar from its start to its expiry, and the moment now cutting across them: one still open, one expired, one without an end.',
    fig,
    [
      'A grant adds credits from a moment, and may take them back at another. Usage drains the grant that expires soonest first, so nothing is left to lapse while a longer one is spent. When a grant expires, its unused remainder is written off with an event of its own, and the balance is simply the fold over all of them.',
    ],
  )
})()

// ---------------------------------------------------------------- 04 Credits · Crossing zero

const zero = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [D('   TIME        EVENT                   Δ        BALANCE')],
    [{ t: '   10-12 09:41 tokens.out  314 × 1   -314      1,250' }],
    [{ t: '   10-12 09:52 tokens.out  980 × 1   -980        270' }],
    [
      {
        t: '   10-12 10:07 tokens.out  412 × 1   -412       -142',
        tone: 'del',
      },
    ],
    [
      { t: '   10-12 10:07 ' },
      { t: 'credit.exhausted', tone: 'del' },
      { t: '                  0' },
    ],
    [
      { t: '   10-12 10:07 ' },
      { t: 'entitlement.revoked', tone: 'del' },
      D('    api'),
    ],
    [],
    [
      { t: '   10-12 10:31 ' },
      { t: 'credit.granted', tone: 'add' },
      { t: '        +5,000      4,858' },
    ],
    [
      { t: '   10-12 10:31 ' },
      { t: 'entitlement.granted', tone: 'add' },
      D('    api'),
    ],
    [],
    [D('   overdraft 142 carried into the grant')],
  ]
  return landscape(
    'm-zero',
    '04 · CREDITS · CROSSING ZERO',
    'Crossing zero',
    'Zero is a line, not a wall. What happens there is an entitlement.',
    '003c',
    '32',
    'A balance crossing zero and coming back: the event that takes it below, the entitlement that closes, the grant that reopens it, and the overdraft carried across.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'THE CROSSING',
        [
          'A metered event is never refused. If it takes the balance below zero, it is recorded, the balance goes negative, and credit.exhausted is written beside it.',
        ],
      ],
      [
        'WHAT CLOSES',
        [
          'The entitlements that depend on credit close on that event. The API stops answering; the ledger keeps counting.',
        ],
      ],
      [
        'COMING BACK',
        [
          'A new grant folds over the negative balance, so the overdraft is paid first. The gate reopens on the grant, with the same event history either side of zero.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 05 Invoices · Usage in, invoice out

const usageOut = (() => {
  const x0 = 56,
    y = 250
  const n = 11
  const fig = (
    <>
      <g fill="none" stroke={MID} strokeWidth={HAIR}>
        {Array.from({ length: n }, (_, i) => {
          const yy = 176 + ((y - 176) * 2 * i) / (n - 1)
          return (
            <path
              key={i}
              d={`M ${x0} ${yy} C ${x0 + 100} ${yy}, ${x0 + 50} ${y}, ${x0 + 150} ${y}`}
            />
          )
        })}
      </g>
      {Array.from({ length: n }, (_, i) => (
        <Anchor
          key={i}
          at={[x0, 176 + ((y - 176) * 2 * i) / (n - 1)]}
          size={2.4}
        />
      ))}
      <line
        x1={x0 + 150}
        x2={x0 + 190}
        y1={y}
        y2={y}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <circle cx={x0 + 150} cy={y} r={3.5} fill={LINE} />
      <rect
        x={x0 + 190}
        y={y - 46}
        width={98}
        height={92}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <rect x={x0 + 200} y={y - 36} width={24} height={4} fill={DIM} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={x0 + 200}
            y={y - 18 + i * 12}
            width={30}
            height={3}
            fill={MID}
          />
          <rect
            x={x0 + 258}
            y={y - 18 + i * 12}
            width={20}
            height={3}
            fill={MID}
          />
        </g>
      ))}
      <line
        x1={x0 + 200}
        x2={x0 + 278}
        y1={y + 22}
        y2={y + 22}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <rect x={x0 + 250} y={y + 28} width={28} height={6} fill={LINE} />
      <Callout at={[x0, 176]} to={[x0, 148]} route="v">
        USAGE · 5,015,338 EVENTS
      </Callout>
      <Callout at={[x0 + 150, y]} to={[x0 + 150, 326]} route="v" side="left">
        PERIOD CLOSES · FOLD READ
      </Callout>
      <Callout
        at={[x0 + 288, y - 46]}
        to={[x0 + 288, 148]}
        route="v"
        dot={false}
        side="left"
      >
        INVOICE · 3 LINES
      </Callout>
    </>
  )
  return portrait(
    'm-usage',
    '05 · INVOICES · USAGE IN, INVOICE OUT',
    'Usage in, invoice out',
    'The invoice is the fold, read at the close of the period.',
    '004b',
    '38',
    'Usage as strands into one point, and the invoice as the sheet that point writes: the period closes, each meter is read, and a line is made of each reading.',
    fig,
    [
      'Nothing is typed into an invoice. When a period closes, every meter on the product is read, and each reading becomes a line: the quantity, the rate it was priced at, the sum. Credits come off, the total follows, and the invoice is issued as an event of its own, so it, too, is on the ledger and can be replayed.',
    ],
  )
})()

// ---------------------------------------------------------------- 05 Invoices · Proration

const proration = (() => {
  const x0 = 60,
    x1 = 340,
    y = 236
  const sw = 0.4
  const fig = (
    <>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={MID} strokeWidth={HAIR} />
      {[0, 1].map((t) => (
        <g key={t}>
          <line
            x1={x0 + (x1 - x0) * t}
            x2={x0 + (x1 - x0) * t}
            y1={y - 6}
            y2={y + 6}
            stroke={MID}
            strokeWidth={HAIR}
          />
          <text
            x={x0 + (x1 - x0) * t}
            y={y + 18}
            fontSize={7}
            fill={DIM}
            textAnchor="middle"
            style={MONO}
          >
            {t === 0 ? 'OCT 01' : 'OCT 31'}
          </text>
        </g>
      ))}
      <Hatch id="pro-hatch" />
      <rect
        x={x0}
        y={y - 40}
        width={(x1 - x0) * sw}
        height={22}
        fill={BG}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <rect
        x={x0}
        y={y - 40}
        width={(x1 - x0) * sw}
        height={22}
        fill="url(#pro-hatch)"
      />
      <rect
        x={x0 + (x1 - x0) * sw}
        y={y - 70}
        width={(x1 - x0) * (1 - sw)}
        height={52}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <text
        x={x0 + ((x1 - x0) * sw) / 2}
        y={y - 26}
        fontSize={7.5}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        HOBBY · $0
      </text>
      <text
        x={x0 + (x1 - x0) * sw + ((x1 - x0) * (1 - sw)) / 2}
        y={y - 41}
        fontSize={7.5}
        fill={LINE}
        textAnchor="middle"
        style={MONO}
      >
        PRO · $20 × 19/31
      </text>
      <Guide
        a={[x0 + (x1 - x0) * sw, y - 90]}
        b={[x0 + (x1 - x0) * sw, y + 6]}
      />
      <Anchor at={[x0 + (x1 - x0) * sw, y]} />
      <Callout
        at={[x0 + (x1 - x0) * sw, y - 90]}
        to={[x0 + (x1 - x0) * sw, y - 112]}
        route="v"
        dot={false}
      >
        OCT 12 · subscription.updated
      </Callout>
      <Callout
        at={[x1, y - 44]}
        to={[x1 + 4, y + 50]}
        route="v"
        dot={false}
        side="left"
      >
        LINE · $12.26
      </Callout>
    </>
  )
  return portrait(
    'm-proration',
    '05 · INVOICES · PRORATION',
    'Proration',
    'A change mid-period is an event; the line is the fraction.',
    '004c',
    '40',
    'A subscription upgraded on the twelfth: the old plan for the first part of the month, the new one for the rest, and the invoice line as the fraction of the period the new plan was active.',
    fig,
    [
      'When a subscription changes mid-period, nothing is estimated. The change is an event with a time, so the period splits at that time: the old plan is charged for the days before, the new one for the days after, each as a fraction of the period. The line on the invoice is that fraction, and the event beside it says why.',
    ],
  )
})()

// ---------------------------------------------------------------- 06 Entitlements · Benefits

const benefits = (() => {
  const x0 = 70,
    y0 = 160
  const rows: [string, string, boolean][] = [
    ['api', 'ACCESS', true],
    ['credits', '10,000 / MONTH', true],
    ['exports', 'ACCESS', false],
    ['license', 'KEY · 1 SEAT', true],
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
        x2={x0 + 240}
        y1={y0 + 48}
        y2={y0 + 48}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {rows.map(([name, kind, on], i) => {
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
              stroke={on ? LINE : MID}
              strokeWidth={HAIR}
              strokeDasharray={on ? undefined : '2 2'}
            />
            <text
              x={x}
              y={y0 + 77}
              fontSize={7.5}
              fill={on ? LINE : DIM}
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
        at={[x0 + 40 + 2 * 66, y0 + 84]}
        to={[x0 + 40 + 2 * 66, y0 + 134]}
        route="v"
        dot={false}
      >
        NOT ON THIS PLAN
      </Callout>
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
  return portrait(
    'm-benefits',
    '06 · ENTITLEMENTS · BENEFITS',
    'Benefits',
    'What a product grants; an entitlement is the grant, held.',
    '005b',
    '48',
    'A product and the four benefits it may grant: three on this plan, one not. Each benefit becomes an entitlement when the subscription is active.',
    fig,
    [
      'A product declares its benefits: access to the API, a monthly grant of credits, exports, a license key. Each is a template. When a subscription to the product becomes active, every benefit on it is granted as an event, and the entitlement is the fold over those grants and revocations. Change the product’s benefits and the next apply writes the difference.',
    ],
  )
})()

// ---------------------------------------------------------------- 07 Agents · Keys and sessions

const keys = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [
      { t: '$ ' },
      { t: 'polar keys create' },
      D(' --customer acme --agent support-bot'),
    ],
    [
      { t: '✓ ' },
      { t: 'polar_sk_01JA7…' },
      D('   actor key_01JA7 · scope: events:write, state:read'),
    ],
    [],
    [{ t: '$ ' }, { t: 'polar sessions open' }, D(' --key key_01JA7 --ttl 1h')],
    [{ t: '✓ ' }, { t: 'ses_01JB2' }, D('   actor ses_01JB2 · expires 10:41')],
    [],
    [D('   every event this session emits:')],
    [{ t: '   customer  acme' }],
    [{ t: '   agent     support-bot' }],
    [{ t: '   actor     ses_01JB2' }],
    [],
    [{ t: '$ ' }, { t: 'polar keys revoke' }, D(' key_01JA7')],
    [{ t: '✓ ' }, { t: 'key.revoked' }, D('   sessions under it closed · 1')],
  ]
  return landscape(
    'm-keys',
    '07 · AGENTS · KEYS AND SESSIONS',
    'Keys and sessions',
    'A key is an actor that lasts. A session is an actor that ends.',
    '006b',
    '54',
    'Creating a key for an agent, opening a session under it, the three names every event from that session carries, and the revocation that closes it.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'KEYS',
        [
          'A key belongs to an agent and names it on every event. It carries scopes, so a key that can write events may still not read state.',
        ],
      ],
      [
        'SESSIONS',
        [
          'A session is a short-lived actor under a key: a run, a conversation, a job. It has a time to live, and the events it emits name it, so usage can be read per session.',
        ],
      ],
      [
        'REVOCATION',
        [
          'Revoking a key is an event. The sessions under it close, their entitlements fall, and the ledger shows exactly when.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 07 Agents · Just ask

const ask = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [D('you')],
    [{ t: 'Which customers ran out of credits this week?' }],
    [],
    [D('polar')],
    [{ t: 'Three customers crossed zero: Atlas on Tuesday, Northwind on' }],
    [{ t: 'Thursday, and Acme this morning. Each lost API access on the' }],
    [{ t: 'crossing. Shall I grant each of them 1,000 credits?' }],
    [],
    [D('you')],
    [{ t: 'Yes, and tell me when Acme is back.' }],
    [],
    [D('polar')],
    [
      { t: '✓ ' },
      { t: 'credit.granted × 3' },
      D('   evt_01JC1 · evt_01JC2 · evt_01JC3'),
    ],
    [{ t: '✓ ' }, { t: 'entitlement.granted × 3' }, D('   api')],
    [{ t: 'Acme is back. I will say so when its balance drops under 500.' }],
  ]
  return landscape(
    'm-ask',
    '07 · AGENTS · JUST ASK',
    'Just ask',
    'The whole customer is one call away, so an agent can simply ask.',
    '006c',
    '56',
    'A conversation with Polar: a question about the week, an answer read from the ledger, a grant made on request, and a promise to watch.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'WHY IT WORKS',
        [
          'Because every number is a fold over events, any question about a customer is a query over the ledger, and the ledger is one call away.',
        ],
      ],
      [
        'WHAT IT CAN DO',
        [
          'Read any state, replay any meter, and write the events a person could: a grant, a revocation, a note. Each action is an event with the agent as its actor.',
        ],
      ],
      [
        'WHAT IT CANNOT',
        [
          'Change the past. The ledger is append only for agents too, so an agent’s mistake is a visible event, not a silent edit.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- Appendix · The event catalogue

const catalogue = (() => {
  const { line } = term(70, 146, 7.5, 10.4)
  const groups: [string, string[]][] = [
    ['CHECKOUT', ['checkout.created', 'checkout.updated', 'order.paid']],
    [
      'SUBSCRIPTION',
      [
        'subscription.active',
        'subscription.updated',
        'subscription.past_due',
        'subscription.canceled',
      ],
    ],
    [
      'BENEFITS',
      [
        'benefit.granted',
        'benefit.revoked',
        'entitlement.granted',
        'entitlement.revoked',
      ],
    ],
    [
      'CREDITS',
      [
        'credit.granted',
        'credit.consumed',
        'credit.expired',
        'credit.exhausted',
      ],
    ],
    [
      'METERS',
      ['meter.updated', 'period.closed', 'invoice.issued', 'invoice.paid'],
    ],
    [
      'CONFIG',
      ['config.applied', 'price.updated', 'product.created', 'key.revoked'],
    ],
  ]
  const rows: ReactNode[] = []
  groups.forEach(([g, evs], k) => {
    const col = k < 3 ? 0 : 44
    const base = (k % 3) * 8
    rows.push(line(base, col, [D(g)], `g${k}`))
    evs.forEach((e, i) =>
      rows.push(line(base + 1 + i, col, [{ t: e }], `${k}-${i}`)),
    )
  })
  return landscape(
    'm-catalogue',
    'APPENDIX · THE EVENT CATALOGUE',
    'The event catalogue',
    'Every event the system writes, by the part of it that writes them.',
    'A01',
    '60',
    'The catalogue: six groups of events, from checkout to config, every one of which may appear on the ledger.',
    rows,
    [
      [
        'NAMING',
        [
          'An event is named object.verb, in the past tense: something happened to a thing. The object is what the fold reads; the verb is what it does to the state.',
        ],
      ],
      [
        'YOURS',
        [
          'Events you emit, like llm.completion, are declared in the config with a schema, and sit on the same ledger as these.',
        ],
      ],
      [
        'STABILITY',
        [
          'A name, once written, is never renamed. A new meaning is a new event, so an old fold keeps folding.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- Appendix · The API, one call

const api = (() => {
  const { line } = term(70, 150, 8, 11.6)
  const rows: TermTok[][] = [
    [{ t: 'GET ' }, { t: '/v1/customers/acme/state' }],
    [],
    [{ t: '{' }],
    [{ t: '  "customer":     "acme",' }],
    [{ t: '  "plan":         "pro",' }],
    [
      {
        t: '  "subscription": { "status": "active", "renews": "2026-11-01" },',
      },
    ],
    [{ t: '  "entitlements": ["api", "agents", "exports"],' }],
    [{ t: '  "meters":       { "tokens": 38210906, "requests": 161204 },' }],
    [{ t: '  "credits":      { "balance": 7250, "expires": "2027-01-01" },' }],
    [{ t: '  "agents":       [{ "id": "support-bot", "actors": 3 }],' }],
    [{ t: '  "asOf":         "evt_01JC3"' }],
    [{ t: '}' }],
    [],
    [D('one call · the fold over 5,015,338 events · 12 ms')],
  ]
  return landscape(
    'm-api',
    'APPENDIX · THE API, ONE CALL',
    'The API, one call',
    'The whole customer, derived and returned from one call.',
    'A02',
    '64',
    'The state endpoint: everything the system knows about a customer, computed from its events and returned in one response, stamped with the last event it folded.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'ONE CALL',
        [
          'There is no separate endpoint for the plan, the meters and the balance. They are one state, folded together, so they are returned together.',
        ],
      ],
      [
        'AS OF',
        [
          'Every response names the last event it folded. Two calls that return the same asOf returned the same state, and a replay to that event will reproduce it.',
        ],
      ],
      [
        'LOCAL FIRST',
        [
          'The same state is what a local-first check answers from. The call is how you get it; the fold is what it is.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- Appendix · Glossary

const glossary = (() => {
  const terms: [string, string][] = [
    [
      'Event',
      'A fact with a time: this customer, through this actor, did this, this much.',
    ],
    ['Ledger', 'The ordered, append-only record of events.'],
    [
      'Fold',
      'A function from the state so far and the next event to the next state.',
    ],
    ['Meter', 'A fold that reads a number off the events it is on.'],
    ['Reading', 'The value of a meter at a moment.'],
    ['Credit', 'A balance folded from grants and usage.'],
    ['Benefit', 'What a product grants on subscription.'],
    ['Entitlement', 'A benefit, held: a gate the subscription keeps open.'],
    ['Actor', 'Who emitted an event: a key, a session, a person.'],
    ['Agent', 'A named group of actors under a customer.'],
    ['Replay', 'Running a fold over the ledger again and comparing.'],
    [
      'Apply',
      'Writing the difference between a config and a deployment as events.',
    ],
  ]
  const fig = (
    <>
      {terms.map(([t, d], i) => {
        const col = i < 6 ? 0 : 1
        const y = 166 + (i % 6) * 44
        const x = 60 + col * 300
        return (
          <g key={t}>
            <text x={x} y={y} fontSize={10.5} fill={LINE} style={TITLE}>
              {t}
            </text>
            {(() => {
              const words = d.split(' ')
              const lines: string[] = []
              let cur = ''
              for (const w of words) {
                const next = cur ? `${cur} ${w}` : w
                if (next.length > 44 && cur) {
                  lines.push(cur)
                  cur = w
                } else cur = next
              }
              if (cur) lines.push(cur)
              return lines.map((l, k) => (
                <text
                  key={k}
                  x={x}
                  y={y + 12 + k * 10}
                  fontSize={8.5}
                  fill={DIM}
                  style={TEXT}
                >
                  {l}
                </text>
              ))
            })()}
          </g>
        )
      })}
    </>
  )
  return page(
    'm-glossary',
    'Glossary',
    'Twelve words the book uses, defined once.',
    960,
    540,
    2,
    () =>
      sheet(
        960,
        540,
        'Glossary',
        <>
          <PageHead
            crumb="APPENDIX · GLOSSARY"
            w={960}
            pad={40}
            title="Glossary"
            sub="Twelve words, defined once."
          />
          <Figure x={40} y={156} w={880} h={300} dy={26} n="A03">
            {fig}
          </Figure>
        </>,
      ),
  )
})()

export const more: Piece[] = [
  environments,
  ingestion,
  replay,
  tiers,
  reconciliation,
  grants,
  zero,
  usageOut,
  proration,
  benefits,
  keys,
  ask,
  catalogue,
  api,
  glossary,
]
