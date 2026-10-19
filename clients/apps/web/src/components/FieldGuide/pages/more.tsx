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
  return landscape(
    'm-ingest',
    'Ingestion and ordering',
    'Events arrive out of order. The ledger keeps them in it.',
    'Six events arrive in one order and are placed in another: the ledger orders by the time the event happened, not the time it landed. The two that arrived late are drawn in ink.',
    fig,
    [
      [
        'Arrival',
        [
          'Events arrive late, early and in bursts. Each carries the time it happened, and the ledger orders by that, not by arrival.',
        ],
      ],
      [
        'Same answer',
        [
          'A fold over the ledger therefore gives the same answer whether an event took a millisecond or a day to arrive, and a late event slots into its place rather than onto the end.',
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
              strokeWidth={HAIR}
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
        <g key={i}>
          <line
            x1={x0 + (x1 - x0) * t}
            x2={x0 + (x1 - x0) * t}
            y1={y0 + h}
            y2={y0 + h + 4}
            stroke={MID}
            strokeWidth={HAIR}
          />
          <text
            x={x0 + (x1 - x0) * t}
            y={y0 + h + 15}
            fontSize={7.5}
            fill={DIM}
            textAnchor="middle"
            style={MONO}
          >
            {['0', '1M', '2M', '∞'][i]}
          </text>
        </g>
      ))}
      <text
        x={(x0 + x1) / 2}
        y={y0 + h + 32}
        fontSize={7.5}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        TOKENS
      </text>
      <text
        x={x0}
        y={y0 - 10}
        fontSize={7.5}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        RATE
      </text>
    </>
  )
  return landscape(
    'm-tiers',
    'Rates and tiers',
    'A rate is a function of the reading; tiers make it a step.',
    'A graduated price: three tiers, each with its own rate per million, drawn as a step function over the meter.',
    fig,
    [
      [
        'Flat',
        ['A price is a function of a reading. Flat means one rate throughout.'],
      ],
      [
        'Graduated',
        [
          'Each tier is charged at its own rate, so the first million costs more than the third.',
        ],
      ],
      ['Volume', ['The tier the total lands in sets the rate for all of it.']],
      [
        'Declared',
        [
          'Tiers are declared in the config next to the meter they price, and a cap bounds the sum.',
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
  // Events step Igloo's balance up as they land; Polar's snapshots settle it at three points along the way.
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
      {label(x0 - 8, BASE + 2.5, 'IGLOO')}
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

      <rect
        x={x0}
        y={BAND}
        width={last - x0}
        height={8}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <rect
        x={last}
        y={BAND}
        width={x1 - last}
        height={8}
        fill={BG}
        stroke={FAINT}
        strokeWidth={HAIR}
      />
      {label((x0 + last) / 2, BAND + 22, 'SETTLED · FROM POLAR', 'middle')}
      {label((last + x1) / 2, BAND + 22, 'LOCAL · OPEN BUCKETS', 'middle')}
    </>
  )
  return landscape(
    'm-reconcile',
    'Reconciliation',
    'Igloo answers now. Polar\u2019s snapshots correct it as buckets close.',
    'Igloo\u2019s balance as one step line, rising as events land, with Polar\u2019s snapshots settling it at points along the way: settled usage from Polar up to the latest snapshot, open local buckets after it.',
    fig,
    [
      [
        'Two folds',
        [
          'Igloo folds what your process has seen. Polar folds everything, including events from your other processes and events that arrived late.',
        ],
      ],
      [
        'Snapshots',
        [
          'When a bucket closes, a late event lands or credits change, Polar pushes a snapshot: the customer\u2019s settled usage up to a point in time. It replaces Igloo\u2019s totals before that point, and the local buckets behind it are dropped.',
        ],
      ],
      [
        'Never backwards',
        [
          'Every snapshot carries a version, and an older one is never applied over a newer one. If the connection drops, Igloo keeps answering from what it has and asks for fresh snapshots when it is back.',
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
  return landscape(
    'm-grants',
    'Grants and expiry',
    'A grant is an event with a start and, sometimes, an end.',
    'Three grants on a timeline, each a bar from its start to its expiry, and the moment now cutting across them: one still open, one expired, one without an end.',
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
          'When a grant expires, its unused remainder is written off with an event of its own, and the balance is simply the fold over all of them.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 05 Credits · Crossing zero

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
    'Crossing zero',
    'Zero is a line, not a wall. What happens there is an entitlement.',
    'A balance crossing zero and coming back: the event that takes it below, the entitlement that closes, the grant that reopens it, and the overdraft carried across.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'The crossing',
        [
          'A metered event is never refused. If it takes the balance below zero, it is recorded, the balance goes negative, and credit.exhausted is written beside it.',
        ],
      ],
      [
        'What closes',
        [
          'The entitlements that depend on credit close on that event. The API stops answering; the ledger keeps counting.',
        ],
      ],
      [
        'Coming back',
        [
          'A new grant folds over the negative balance, so the overdraft is paid first. The gate reopens on the grant, with the same event history either side of zero.',
        ],
      ],
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
  return landscape(
    'm-benefits',
    'Benefits',
    'What a product grants; an entitlement is the grant, held.',
    'A product and the four benefits it may grant: three on this plan, one not. Each benefit becomes an entitlement when the subscription is active.',
    fig,
    [
      [
        'Templates',
        [
          'A product declares its benefits: access to the API, a monthly grant of credits, exports, a license key. Each is a template.',
        ],
      ],
      [
        'Granted',
        [
          'When a subscription to the product becomes active, every benefit on it is granted as an event, and the entitlement is the fold over those grants and revocations.',
        ],
      ],
      [
        'Changes',
        [
          'Change the product’s benefits and the next apply writes the difference.',
        ],
      ],
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
    'Keys and sessions',
    'A key is an actor that lasts. A session is an actor that ends.',
    'Creating a key for an agent, opening a session under it, the three names every event from that session carries, and the revocation that closes it.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'Keys',
        [
          'A key belongs to an agent and names it on every event. It carries scopes, so a key that can write events may still not read state.',
        ],
      ],
      [
        'Sessions',
        [
          'A session is a short-lived actor under a key: a run, a conversation, a job. It has a time to live, and the events it emits name it, so usage can be read per session.',
        ],
      ],
      [
        'Revocation',
        [
          'Revoking a key is an event. The sessions under it close, their entitlements fall, and the ledger shows exactly when.',
        ],
      ],
    ],
  )
})()

// ---------------------------------------------------------------- 07 Agents · Asking the ledger

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
    'Asking the ledger',
    'Any question about a customer is a query over its events.',
    'A conversation with Polar: a question about the week, an answer read from the ledger, a grant made on request, and a promise to watch.',
    <>
      {rows.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>,
    [
      [
        'Why it works',
        [
          'Because every number is a fold over events, any question about a customer is a query over the ledger, and the ledger is one call away.',
        ],
      ],
      [
        'What it can do',
        [
          'Read any state, replay any meter, and write the events a person could: a grant, a revocation, a note. Each action is an event with the agent as its actor.',
        ],
      ],
      [
        'What it cannot',
        [
          'Change the past. The ledger is append only for agents too, so an agent’s mistake is a visible event, not a silent edit.',
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
  benefits,
  keys,
  ask,
]
