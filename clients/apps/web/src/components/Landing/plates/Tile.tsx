import type { ReactNode } from 'react'
import { Sheet, MONO } from '@/components/FieldGuide/sheet'
import { LINE, MID, DIM, BG, HAIR } from '@/components/FieldGuide/kit'

/**
 * A square plate for the landing's cards, drawn with the manual's kit: Night ground, Snow hairlines, square
 * anchors, dotted leaders and mono labels. 300 units a side, scaled to the card.
 */
export const S = 300

export function Tile({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Sheet w={S} h={S} surface="night" unsigned title={title}>
      {children}
    </Sheet>
  )
}

/** A time axis: a hairline, a tick at every boundary and the label beneath it. */
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

/** A slot on a row: open, closed or sealed (hatched). */
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
  tone: 'ink' | 'mid' | 'sealed'
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={tone === 'sealed' ? 'url(#tile-seal)' : BG}
        stroke={tone === 'mid' ? MID : LINE}
        strokeWidth={HAIR}
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

/** A labelled box with key and value rows. */
export function Record({
  x,
  y,
  w,
  label,
  rows,
}: {
  x: number
  y: number
  w: number
  label: string
  rows: [string, string][]
}) {
  const h = 26 + rows.length * 12
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <text x={x + 10} y={y + 14} fontSize={8.5} fill={LINE} style={MONO}>
        {label}
      </text>
      {rows.map(([k, v], i) => (
        <g key={k} style={{ ...MONO, letterSpacing: 0 }} fontSize={7.5}>
          <text x={x + 10} y={y + 30 + i * 12} fill={DIM}>
            {k}
          </text>
          <text x={x + w - 10} y={y + 30 + i * 12} fill={LINE} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
    </g>
  )
}
