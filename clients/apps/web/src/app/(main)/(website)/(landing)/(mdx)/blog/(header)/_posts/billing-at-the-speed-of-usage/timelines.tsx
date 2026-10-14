import { MONO } from '@/components/FieldGuide/sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  DOTTED,
  Anchor,
  Callout,
  Guide,
  Hatch,
} from '@/components/FieldGuide/kit'
import { Plate } from './figures'

/** A time axis: a hairline, a tick at every slot boundary and the time beneath it. */
export function Axis({
  x0,
  y,
  sw,
  labels,
}: {
  x0: number
  y: number
  sw: number
  labels: string[]
}) {
  return (
    <g>
      <line
        x1={x0}
        x2={x0 + sw * (labels.length - 1)}
        y1={y}
        y2={y}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {labels.map((l, i) => (
        <g key={i}>
          <line
            x1={x0 + i * sw}
            x2={x0 + i * sw}
            y1={y - 3}
            y2={y + 3}
            stroke={MID}
            strokeWidth={HAIR}
          />
          <text
            x={x0 + i * sw}
            y={y + 14}
            fontSize={7.5}
            fill={DIM}
            textAnchor="middle"
            style={MONO}
          >
            {l}
          </text>
        </g>
      ))}
    </g>
  )
}

export function Slot({
  x,
  y,
  w,
  h,
  label,
  tone,
}: {
  x: number
  y: number
  w: number
  h: number
  label?: string
  tone: 'ink' | 'mid' | 'dotted' | 'sealed'
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={tone === 'sealed' ? 'url(#seal)' : BG}
        stroke={tone === 'ink' || tone === 'sealed' ? LINE : MID}
        strokeWidth={HAIR}
        {...(tone === 'dotted' ? DOTTED : {})}
      />
      {label ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 2.5}
          fontSize={7.5}
          fill={DIM}
          textAnchor="middle"
          style={MONO}
        >
          {label}
        </text>
      ) : null}
    </g>
  )
}

/** A bracket under a span of slots, with its name beneath. */
function Group({
  a,
  b,
  y,
  label,
}: {
  a: number
  b: number
  y: number
  label: string
}) {
  return (
    <g>
      <path
        d={`M${a} ${y - 4}v4H${b}v-4`}
        fill="none"
        stroke={MID}
        strokeWidth={HAIR}
      />
      <text
        x={(a + b) / 2}
        y={y + 16}
        fontSize={8.5}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        {label}
      </text>
    </g>
  )
}

/** Events fall into five-minute buckets. Closed slots are rows in Postgres, the open ones still count in Redis. */
export function Ingestion() {
  const x0 = 60,
    sw = 96,
    y = 180,
    h = 40
  const slot = (i: number) => x0 + i * sw
  const closed = ['Σ 12,480', 'Σ 9,310', 'Σ 14,002']
  const open = ['Σ 11,756', 'Σ 3,920']
  const events: [number, number][] = [
    [82, 96],
    [118, 128],
    [140, 72],
    [172, 110],
    [206, 140],
    [230, 84],
    [262, 118],
    [296, 100],
    [330, 134],
    [374, 78],
    [404, 122],
    [432, 94],
    [468, 112],
    [496, 146],
  ]
  return (
    <Plate title="Folded at ingestion">
      {events.map(([ex, ey]) => (
        <g key={ex}>
          <Guide a={[ex, ey + 4]} b={[ex, y]} />
          <Anchor at={[ex, ey]} />
        </g>
      ))}
      {closed.map((label, i) => (
        <Slot key={i} x={slot(i)} y={y} w={sw} h={h} label={label} tone="mid" />
      ))}
      {open.map((label, i) => (
        <Slot
          key={i}
          x={slot(3 + i)}
          y={y}
          w={sw}
          h={h}
          label={label}
          tone="ink"
        />
      ))}
      <Axis
        x0={x0}
        y={y + h + 8}
        sw={sw}
        labels={['11:45', '11:50', '11:55', '12:00', '12:05', '12:10']}
      />
      <Group
        a={slot(0) + 4}
        b={slot(3) - 4}
        y={y + h + 44}
        label="POSTGRES · CLOSED BUCKETS · ONE ROW EACH"
      />
      <Group
        a={slot(3) + 4}
        b={slot(5) - 4}
        y={y + h + 44}
        label="REDIS · OPEN · STILL COUNTING"
      />
      <Callout at={[slot(2) + sw / 2, y]} to={[slot(2) + sw / 2, 60]} route="v">
        CLOSED AT 12:00 · WRITTEN AS A ROW
      </Callout>
    </Plate>
  )
}

/** A billing period over buckets: split at both edges, sealed in between, late events to the next generation. */
export function Sealing() {
  const x0 = 50,
    sw = 80,
    y = 150,
    h = 28
  const slot = (i: number) => x0 + i * sw
  const from = slot(0) + sw * 0.4
  const cutoff = slot(5) + sw * 0.4
  const late = slot(1) + sw / 2
  return (
    <Plate title="Sealed on billing" shift={[10, 11]}>
      <Hatch id="seal" />
      <Slot x={slot(0)} y={y} w={from - slot(0)} h={h} tone="mid" />
      <Slot x={from} y={y} w={slot(1) - from} h={h} tone="sealed" />
      {[1, 2, 4].map((i) => (
        <Slot key={i} x={slot(i)} y={y} w={sw} h={h} tone="sealed" />
      ))}
      <Slot x={slot(3)} y={y} w={sw} h={h} label="···" tone="ink" />
      <Slot x={slot(5)} y={y} w={cutoff - slot(5)} h={h} tone="sealed" />
      <Slot
        x={cutoff}
        y={y}
        w={slot(6) - cutoff}
        h={h}
        label="OPEN"
        tone="mid"
      />
      <Axis
        x0={x0}
        y={y + h + 8}
        sw={sw}
        labels={['10:00', '10:05', '10:10', '', '12:00', '12:05', '12:10']}
      />
      <Guide a={[from, 96]} b={[from, y - 12]} />
      <Guide a={[cutoff, 96]} b={[cutoff, y - 12]} />
      <Anchor at={[from, y]} />
      <Anchor at={[cutoff, y]} />
      <Callout at={[from, 96]} to={[from, 80]} route="v" dot={false}>
        BILLABLE FROM · 10:02 · SPLIT
      </Callout>
      <Callout
        at={[cutoff, 96]}
        to={[cutoff, 80]}
        route="v"
        side="left"
        dot={false}
      >
        CUTOFF · 12:07 · SPLIT
      </Callout>
      <path
        d={`M${from} ${y - 6}v-6H${cutoff}v6`}
        fill="none"
        stroke={MID}
        strokeWidth={HAIR}
      />
      <text
        x={(from + cutoff) / 2}
        y={y - 18}
        fontSize={8.5}
        fill={DIM}
        textAnchor="middle"
        style={MONO}
      >
        SEALED · NEVER CHANGES
      </text>
      <Anchor at={[late, 104]} />
      <Guide a={[late, 108]} b={[late, y]} />
      <Guide a={[late, y + h]} b={[late, y + 64]} />
      <Callout at={[late, 104]} to={[late + 30, 104]} dot={false}>
        LATE EVENT · ARRIVES AFTER THE INVOICE
      </Callout>
      <Slot
        x={slot(1)}
        y={y + 64}
        w={sw}
        h={h}
        label="ROW 2 · OPEN"
        tone="mid"
      />
      <Callout at={[slot(2), y + 78]} to={[slot(2) + 24, y + 78]}>
        SAME SLOT · SEALED ROW UNTOUCHED · BILLED NEXT INVOICE
      </Callout>
    </Plate>
  )
}
