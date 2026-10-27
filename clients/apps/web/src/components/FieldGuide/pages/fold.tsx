import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, DOTTED, Anchor, Dimension } from '../kit'
import { landscape } from './more'

/**
 * Reducers and buckets: a reducer matches events, each slot of the strip adds into the five-minute bucket beneath it,
 * and every bucket keeps a count and a sum. The billed buckets are sealed, and the rest are still open.
 */

const X0 = 100,
  BW = 80,
  SLOTS = 6
const LANE = 210
const TOP = 252,
  BH = 50
/** Minutes past the hour, and the tokens each event carries. */
const EVENTS: [number, number][] = [
  [0.8, 320],
  [2.1, 1240],
  [3.9, 560],
  [6.2, 880],
  [7.0, 210],
  [9.4, 1400],
  [11.3, 640],
  [13.8, 300],
  [16.1, 980],
  [17.5, 450],
  [21.2, 760],
  [23.6, 1100],
  [26.4, 380],
  [28.9, 920],
]
const SEALED = 4

const at = (minute: number) => X0 + (minute / 5) * BW
const fmt = (v: number) => v.toLocaleString('en-US')
const label = (x: number, y: number, t: string, fill = DIM, size = 7.5) => (
  <text
    x={x}
    y={y}
    fontSize={size}
    fill={fill}
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

function figure() {
  const buckets = Array.from({ length: SLOTS }, (_, i) => {
    const inSlot = EVENTS.filter(([m]) => m >= i * 5 && m < (i + 1) * 5)
    return {
      count: inSlot.length,
      sum: inSlot.reduce((t, [, q]) => t + q, 0),
    }
  })
  const end = at(SLOTS * 5)
  return (
    <>
      <rect
        x={X0}
        y={116}
        width={160}
        height={52}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      {label(X0 + 12, 132, 'REDUCER')}
      {label(X0 + 12, 146, 'Σ output_tokens', LINE, 8.5)}
      {label(X0 + 12, 160, 'where name = "llm.completion"')}

      <line
        x1={X0}
        x2={end}
        y1={LANE}
        y2={LANE}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <text
        x={X0 - 12}
        y={LANE + 2.5}
        fontSize={7.5}
        fill={DIM}
        textAnchor="end"
        style={{ ...MONO, letterSpacing: 0 }}
      >
        EVENTS
      </text>
      {/* Each event on the lane at the minute it happened, dropping into the bucket beneath it. */}
      {EVENTS.map(([m], i) => (
        <g key={i}>
          <line
            x1={at(m)}
            x2={at(m)}
            y1={LANE + 3}
            y2={TOP - 4}
            stroke={DIM}
            strokeWidth={HAIR}
            {...DOTTED}
          />
          <path
            d={`M${at(m) - 2} ${TOP - 4}L${at(m)} ${TOP - 1}L${at(m) + 2} ${TOP - 4}Z`}
            fill={DIM}
          />
        </g>
      ))}
      {EVENTS.map(([m]) => (
        <Anchor key={m} at={[at(m), LANE]} size={2.6} />
      ))}
      <text
        x={X0 - 12}
        y={TOP + 22}
        fontSize={7.5}
        fill={DIM}
        textAnchor="end"
        style={{ ...MONO, letterSpacing: 0 }}
      >
        BUCKETS
      </text>
      <text
        x={X0 - 12}
        y={TOP + 37}
        fontSize={7.5}
        fill={DIM}
        textAnchor="end"
        style={{ ...MONO, letterSpacing: 0 }}
      >
        Σ tokens
      </text>

      {/* One outline for the sealed run, one dotted for the open one, and each divider drawn once. */}
      <rect
        x={X0}
        y={TOP}
        width={SEALED * BW}
        height={BH}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <path
        d={`M${X0 + SEALED * BW} ${TOP}H${end}V${TOP + BH}H${X0 + SEALED * BW}`}
        fill="none"
        stroke={MID}
        strokeWidth={HAIR}
        {...DOTTED}
      />
      {buckets.map((b, i) => {
        const x = X0 + i * BW
        const open = i >= SEALED
        return (
          <g key={i}>
            {i > 0 && i !== SEALED ? (
              <line
                x1={x}
                x2={x}
                y1={TOP}
                y2={TOP + BH}
                stroke={open ? MID : LINE}
                strokeWidth={HAIR}
                {...(open ? DOTTED : {})}
              />
            ) : null}
            {label(x + 10, TOP + 22, fmt(b.sum), open ? DIM : LINE, 10)}
            {label(x + 10, TOP + 37, `${b.count} events`)}
            {label(x, TOP + BH + 16, `14:${String(i * 5).padStart(2, '0')}`)}
          </g>
        )
      })}

      <Dimension
        a={[X0, TOP + BH + 34]}
        b={[X0 + SEALED * BW, TOP + BH + 34]}
        text="SEALED · BILLED"
        side={12}
      />
      <Dimension
        a={[X0 + SEALED * BW, TOP + BH + 34]}
        b={[end, TOP + BH + 34]}
        text="OPEN"
        side={12}
      />
    </>
  )
}

export const fold = landscape(
  'm-fold',
  'Reducers and buckets',
  'Events add up into five-minute buckets, and an invoice adds up the buckets.',
  'A reducer over half an hour: events drop into the five-minute bucket their timestamp falls in, each bucket keeps a count and a sum, and the billed buckets are sealed.',
  figure(),
  [
    [
      'Reducers',
      [
        'A meter says which events count and how to add them up: count them, or sum, average, minimum or maximum a property. That rule is a reducer. Meters with the same rule share one, so the work is done once.',
      ],
    ],
    [
      'Buckets',
      [
        'Each matching event lands in the five-minute bucket its timestamp falls in, one per customer. A bucket keeps a count, sum, minimum and maximum, enough to answer any of those for any period.',
      ],
    ],
    [
      'Sealed once billed',
      [
        'When a period is billed, its buckets are sealed and never change. An event for that period that arrives late still counts at the time it happened, and is charged on the next invoice.',
      ],
    ],
  ],
)
