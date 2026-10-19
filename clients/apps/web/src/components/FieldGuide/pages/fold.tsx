import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, DOTTED, Anchor, Dimension } from '../kit'
import { landscape } from './more'

/**
 * Reducers and buckets: a reducer matches events, each slot of the strip adds into the five-minute bucket beneath it,
 * and every bucket keeps a count and a sum. The billed buckets are sealed; an older event that arrives after the seal
 * goes into a new generation of its bucket, drawn open beneath it.
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
/** An event from 14:08 that arrived after its bucket was sealed, and the height of the generation it opens. */
const LATE: [number, number] = [8.3, 500]
const LATE_SLOT = Math.floor(LATE[0] / 5)
const GEN_H = 22

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
      <circle cx={at(LATE[0])} cy={LANE} r={2.2} fill={LINE} />
      {label(at(LATE[0]) + 6, LANE - 8, 'LATE · 14:08', LINE)}

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
            {label(
              x,
              TOP + BH + GEN_H + 16,
              `14:${String(i * 5).padStart(2, '0')}`,
            )}
          </g>
        )
      })}

      {/* The late event's own generation of the sealed bucket: open, and billed on the next invoice. */}
      <rect
        x={X0 + LATE_SLOT * BW}
        y={TOP + BH}
        width={BW}
        height={GEN_H}
        fill={BG}
        stroke={MID}
        strokeWidth={HAIR}
        {...DOTTED}
      />
      {label(
        X0 + LATE_SLOT * BW + 10,
        TOP + BH + 14,
        `gen 2  +${fmt(LATE[1])}`,
        LINE,
      )}

      <Dimension
        a={[X0, TOP + BH + GEN_H + 34]}
        b={[X0 + SEALED * BW, TOP + BH + GEN_H + 34]}
        text="SEALED · BILLED"
        side={12}
      />
      <Dimension
        a={[X0 + SEALED * BW, TOP + BH + GEN_H + 34]}
        b={[end, TOP + BH + GEN_H + 34]}
        text="OPEN"
        side={12}
      />
    </>
  )
}

export const fold = landscape(
  'm-fold',
  'Reducers and buckets',
  'Events add up into five-minute buckets. An invoice adds up buckets, not events.',
  'A reducer over half an hour: events drop into the five-minute bucket their timestamp falls in, each bucket keeps a count and a sum, the billed buckets are sealed, and an event from 14:08 that arrived after the seal opens a second generation of its bucket.',
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
      'Sealed, not closed',
      [
        'When a period is billed, its buckets are sealed and never change. An older event can still arrive: it goes into a new generation of the same bucket, so it counts at the time it happened and is billed on the next invoice.',
      ],
    ],
  ],
)
