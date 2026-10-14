import { MONO } from '@/components/FieldGuide/sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  Anchor,
  Callout,
  Guide,
} from '@/components/FieldGuide/kit'
import { Plate } from './figures'

/** A box full of vertical ticks: a table, drawn as the rows it holds. */
function Rows({
  x,
  y,
  w,
  h,
  label,
  ticks,
  tone = 'mid',
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  ticks: number
  tone?: 'ink' | 'mid'
}) {
  const gap = (w - 20) / ticks
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={BG}
        stroke={tone === 'ink' ? LINE : MID}
        strokeWidth={HAIR}
      />
      {Array.from({ length: ticks }, (_, i) => (
        <line
          key={i}
          x1={x + 10 + i * gap + gap / 2}
          x2={x + 10 + i * gap + gap / 2}
          y1={y + 10}
          y2={y + h - 10}
          stroke={tone === 'ink' ? LINE : MID}
          strokeWidth={HAIR}
        />
      ))}
      <text x={x} y={y + h + 14} fontSize={7.5} fill={DIM} style={MONO}>
        {label}
      </text>
    </g>
  )
}

/** The old path kept one row per event all the way to the invoice. The new one keeps one row per five minutes. */
export function BeforeAfter() {
  const lane = (y: number, name: string, rows: number, ink: boolean) => (
    <g>
      <text x={24} y={y + 24} fontSize={8.5} fill={DIM} style={MONO}>
        {name}
      </text>
      <Rows x={90} y={y} w={130} h={40} label="EVENTS" ticks={36} />
      <Guide a={[220, y + 20]} b={[260, y + 20]} />
      <Anchor at={[220, y + 20]} />
      <Anchor at={[260, y + 20]} />
      <Rows
        x={260}
        y={y}
        w={130}
        h={40}
        label={
          ink
            ? 'BUCKETS · 1 ROW PER 5 MIN'
            : 'BILLING ENTRIES · 1 ROW PER EVENT'
        }
        ticks={rows}
        tone={ink ? 'ink' : 'mid'}
      />
      <Guide a={[390, y + 20]} b={[430, y + 20]} />
      <Anchor at={[390, y + 20]} />
      <Anchor at={[430, y + 20]} />
      <rect
        x={430}
        y={y}
        width={130}
        height={40}
        fill={BG}
        stroke={ink ? LINE : MID}
        strokeWidth={HAIR}
      />
      <text
        x={495}
        y={y + 23}
        fontSize={8.5}
        fill={ink ? LINE : DIM}
        textAnchor="middle"
        style={MONO}
      >
        INVOICE
      </text>
    </g>
  )
  return (
    <Plate title="Before and after" shift={[8, -14]}>
      {lane(80, 'BEFORE', 36, false)}
      <Callout
        at={[495, 120]}
        to={[495, 150]}
        route="v"
        side="left"
        dot={false}
      >
        JOIN EVENTS · AGGREGATE · LINK EVERY ROW
      </Callout>
      {lane(210, 'AFTER', 4, true)}
      <Callout
        at={[495, 250]}
        to={[495, 280]}
        route="v"
        side="left"
        dot={false}
      >
        SUM THE ROWS · SEAL THEM
      </Callout>
    </Plate>
  )
}
