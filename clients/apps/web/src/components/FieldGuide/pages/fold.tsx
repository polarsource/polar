import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, DOTTED, Anchor, Dimension } from '../kit'
import { landscape } from './more'

/**
 * The fold, as it runs: a reducer matches events, and each slot of the strip folds into the five-minute bucket beneath it,
 * and every bucket keeps a count and a sum. The buckets behind the open ones are sealed.
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
      {label(X0 + 12, 146, 'Σ tokens', LINE, 8.5)}
      {label(X0 + 12, 160, 'where name = "tokens.out"')}

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
      {/* One guide per bucket: everything in the slot above it folds into it. */}
      {buckets.map((_, i) => (
        <line
          key={i}
          x1={X0 + (i + 0.5) * BW}
          x2={X0 + (i + 0.5) * BW}
          y1={LANE + 3}
          y2={TOP}
          stroke={DIM}
          strokeWidth={HAIR}
          {...DOTTED}
        />
      ))}
      {buckets.map((_, i) => (
        <Anchor key={i} at={[X0 + (i + 0.5) * BW, LANE]} />
      ))}

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
            {label(x + 10, TOP + 20, `count ${b.count}`, open ? DIM : LINE)}
            {label(x + 10, TOP + 36, `sum ${fmt(b.sum)}`, open ? DIM : LINE)}
            {label(x, TOP + BH + 16, `14:${String(i * 5).padStart(2, '0')}`)}
          </g>
        )
      })}

      <Dimension
        a={[X0, TOP + BH + 34]}
        b={[X0 + SEALED * BW, TOP + BH + 34]}
        text="SEALED · NEVER WRITTEN AGAIN"
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
  'The fold',
  'Reducers fold events into five-minute buckets. An invoice adds up buckets, never events.',
  'A reducer over a strip of time: events drop into the five-minute bucket their timestamp falls in, each bucket keeps a count and a sum, and the buckets behind the open ones are sealed.',
  figure(),
  [
    [
      'Reducers',
      [
        'A meter is a filter that says which events count and an aggregation that says how: count them, or sum, minimum, maximum or average a property. That pair is a reducer. Meters that fold the same way share one, so the fold runs once.',
      ],
    ],
    [
      'Buckets',
      [
        'Each matching event adds to a bucket keyed by the reducer, the customer and the five-minute slot its timestamp falls in. A bucket holds four numbers: count, sum, minimum and maximum. From those, every aggregation is recoverable for any period.',
      ],
    ],
    [
      'Sealed on billing',
      [
        'When a period is billed, the buckets at its edges are split at the exact times and every bucket inside is sealed. A late event never alters a sealed bucket; it opens the next one, billed on the next invoice.',
      ],
    ],
  ],
)
