import { MONO } from '@/components/FieldGuide/sheet'
import {
  LINE,
  MID,
  DIM,
  HAIR,
  Anchor,
  Callout,
  Guide,
  Hatch,
} from '@/components/FieldGuide/kit'
import { Axis, Slot, Tile } from './Tile'

/** A meter climbing in steps, one per event, read at the head. */
export function UsagePlate() {
  const x0 = 36,
    x1 = 264,
    base = 220,
    top = 60
  const steps = [0, 0.08, 0.14, 0.3, 0.36, 0.52, 0.58, 0.8, 0.86, 1]
  const n = steps.length
  const px = (i: number) => x0 + ((x1 - x0) * i) / (n - 1)
  const py = (v: number) => base - (base - top) * v
  const d = steps
    .map((v, i) => (i === 0 ? `M${px(i)} ${py(v)}` : `H${px(i)}V${py(v)}`))
    .join('')
  return (
    <Tile title="Usage billing: a meter that climbs with every event">
      <Guide a={[x0, top]} b={[x1, top]} />
      <line
        x1={x0}
        x2={x1}
        y1={base}
        y2={base}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <path d={d} fill="none" stroke={LINE} strokeWidth={HAIR} />
      {steps.map((v, i) =>
        i > 0 && v !== steps[i - 1] ? (
          <Anchor key={i} at={[px(i), py(v)]} />
        ) : null,
      )}
      <Callout
        at={[px(n - 1), py(1)]}
        to={[px(n - 1), 40]}
        route="v"
        side="left"
      >
        1,713 TOKENS · $0.0034
      </Callout>
      <text x={x0} y={base + 14} fontSize={7.5} fill={DIM} style={MONO}>
        NOV 1
      </text>
      <text
        x={x1}
        y={base + 14}
        fontSize={7.5}
        fill={DIM}
        textAnchor="end"
        style={MONO}
      >
        NOW
      </text>
    </Tile>
  )
}

/** Subscriptions: cycles on a line, an upgrade mid-cycle, the prorated part hatched. */
export function SubscriptionPlate() {
  const x0 = 36,
    sw = 114,
    y = 120,
    h = 28
  const upgrade = x0 + sw * 0.5
  return (
    <Tile title="Subscriptions: cycles, an upgrade and its proration">
      <Hatch id="tile-seal" />
      <Slot x={x0} y={y} w={upgrade - x0} h={h} label="STARTER" tone="mid" />
      <Slot x={upgrade} y={y} w={x0 + sw - upgrade} h={h} tone="sealed" />
      <Slot x={x0 + sw} y={y} w={sw} h={h} label="PRO · $49" tone="ink" />
      <Axis
        x0={x0}
        y={y + h + 8}
        sw={sw}
        labels={['NOV 1', 'DEC 1', 'JAN 1']}
      />
      <Guide a={[upgrade, 60]} b={[upgrade, y]} />
      <Anchor at={[upgrade, y]} />
      <Callout at={[upgrade, 60]} to={[upgrade, 44]} route="v" dot={false}>
        UPGRADE · NOV 16
      </Callout>
      <Callout
        at={[upgrade + (sw * 0.5) / 2, y + h]}
        to={[upgrade + (sw * 0.5) / 2, 210]}
        route="v"
      >
        PRORATED
      </Callout>
    </Tile>
  )
}

const BALANCE = [10000, 7200, 4100, 900, 10000, 8500]

/** Credits: a balance drawn down by usage, topped up when it would cross zero. */
export function CreditPlate() {
  const x0 = 36,
    full = 200,
    y0 = 52,
    rh = 30
  const w = (v: number) => (full * v) / 10000
  return (
    <Tile title="Credits: a balance that draws down and tops up">
      <Guide a={[x0, y0 - 12]} b={[x0, y0 + BALANCE.length * rh - 8]} />
      {BALANCE.map((v, i) => {
        const y = y0 + i * rh
        const grant = i === 0 || v > BALANCE[i - 1]
        return (
          <g key={i}>
            <line
              x1={x0}
              x2={x0 + w(v)}
              y1={y}
              y2={y}
              stroke={grant ? LINE : MID}
              strokeWidth={grant ? 2 : HAIR}
            />
            <Anchor at={[x0 + w(v), y]} />
            <text
              x={x0 + w(v) + 10}
              y={y + 2.5}
              fontSize={7.5}
              fill={grant ? LINE : DIM}
              style={{ ...MONO, letterSpacing: 0 }}
            >
              {v.toLocaleString('en-US')}
            </text>
          </g>
        )
      })}
      <Callout
        at={[x0 + full, y0]}
        to={[x0 + full, 28]}
        route="v"
        side="left"
        dot={false}
      >
        GRANT · 10,000
      </Callout>
      <Callout
        at={[x0 + w(900), y0 + 3 * rh]}
        to={[x0 + w(900), y0 + 3 * rh + 15]}
        route="v"
        dot={false}
      >
        WOULD CROSS ZERO · TOPPED UP
      </Callout>
      <text
        x={x0}
        y={y0 + BALANCE.length * rh + 6}
        fontSize={7.5}
        fill={DIM}
        style={MONO}
      >
        0
      </text>
    </Tile>
  )
}
