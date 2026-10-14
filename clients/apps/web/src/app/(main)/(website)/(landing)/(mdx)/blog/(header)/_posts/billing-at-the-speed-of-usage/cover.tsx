import { MONO } from '@/components/FieldGuide/sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  RULE,
  DOTTED,
  TITLE,
  TEXT,
  Anchor,
  Guide,
  Hatch,
} from '@/components/FieldGuide/kit'
import { Plate, W } from './figures'
import { Axis } from './timelines'

const PAD = 24

/**
 * The cover: the title at the left, and at the right the fold itself. Events fall as strands into five-minute
 * buckets; the billed ones are sealed, the current one is still open.
 */
export function Cover() {
  const x0 = 330,
    sw = 76,
    y = 212,
    h = 24
  const slot = (i: number) => x0 + i * sw
  const now = slot(2) + sw * 0.55
  const events: [number, number][] = [
    [346, 112],
    [370, 140],
    [388, 94],
    [418, 126],
    [446, 104],
    [468, 150],
    [486, 90],
    [514, 132],
    [534, 114],
    [550, 154],
  ]
  return (
    <Plate title="Billing at the speed of usage">
      <Hatch id="cover-seal" />
      <text x={PAD} y={PAD + 12} fontSize={8.5} fill={DIM} style={MONO}>
        POLAR · ENGINEERING
      </text>
      <text
        x={W - PAD}
        y={PAD + 12}
        fontSize={8.5}
        fill={DIM}
        textAnchor="end"
        style={MONO}
      >
        2026
      </text>
      <line
        x1={PAD}
        x2={W - PAD}
        y1={PAD + 22}
        y2={PAD + 22}
        stroke={RULE}
        strokeWidth={HAIR}
        {...DOTTED}
      />
      <text x={PAD} y={140} fontSize={28} fill={LINE} style={TITLE}>
        Billing at
      </text>
      <text x={PAD} y={172} fontSize={28} fill={LINE} style={TITLE}>
        the speed
      </text>
      <text x={PAD} y={204} fontSize={28} fill={LINE} style={TITLE}>
        of usage
      </text>
      <text x={PAD} y={234} fontSize={11.5} fill={DIM} style={TEXT}>
        The reducer architecture behind
      </text>
      <text x={PAD} y={250} fontSize={11.5} fill={DIM} style={TEXT}>
        Polar&apos;s metering.
      </text>

      {events.map(([ex, ey]) => (
        <g key={ex}>
          <Guide a={[ex, ey + 4]} b={[ex, y]} />
          <Anchor at={[ex, ey]} />
        </g>
      ))}
      {[0, 1].map((i) => (
        <rect
          key={i}
          x={slot(i)}
          y={y}
          width={sw}
          height={h}
          fill="url(#cover-seal)"
          stroke={LINE}
          strokeWidth={HAIR}
        />
      ))}
      <rect
        x={slot(2)}
        y={y}
        width={sw}
        height={h}
        fill={BG}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <text
        x={slot(2) + sw / 2}
        y={y + h / 2 + 2.5}
        fontSize={7.5}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        OPEN
      </text>
      <Axis
        x0={x0}
        y={y + h + 8}
        sw={sw}
        labels={['12:00', '12:05', '12:10', '12:15']}
      />
      <Guide a={[now, 70]} b={[now, y + h + 26]} />
      <text x={now + 8} y={72} fontSize={8.5} fill={DIM} style={MONO}>
        NOW
      </text>
      <text x={slot(0)} y={y - 8} fontSize={8.5} fill={DIM} style={MONO}>
        SEALED
      </text>
    </Plate>
  )
}
