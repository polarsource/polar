import type { ReactNode } from 'react'
import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, DOTTED, FAINT } from '../kit'
import { landscape } from './more'

/**
 * Where Outpost sits: between your app and Polar, as a proxy. Your code calls it in-process; it keeps its state in a
 * Redis you run; events go up to Polar batched, and reducers and snapshots come back down.
 */

const text = (
  x: number,
  y: number,
  t: string,
  fill = DIM,
  size = 7.5,
  anchor: 'start' | 'middle' | 'end' = 'start',
) => (
  <text
    x={x}
    y={y}
    fontSize={size}
    fill={fill}
    textAnchor={anchor}
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

/** A box with a name and a line under it. */
const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  line: string,
) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={BG}
      stroke={MID}
      strokeWidth={HAIR}
    />
    {text(x + 12, y + 18, name, DIM, 8.5)}
    {text(x + 12, y + 32, line)}
  </g>
)

/** An arrowhead at a point, pointing along an axis. */
const head = (x: number, y: number, dir: 'up' | 'down' | 'left' | 'right') => {
  const d = {
    up: `M${x - 3} ${y + 4}L${x} ${y}L${x + 3} ${y + 4}`,
    down: `M${x - 3} ${y - 4}L${x} ${y}L${x + 3} ${y - 4}`,
    left: `M${x + 4} ${y - 3}L${x} ${y}L${x + 4} ${y + 3}`,
    right: `M${x - 4} ${y - 3}L${x} ${y}L${x - 4} ${y + 3}`,
  }[dir]
  return <path d={d} fill="none" stroke={MID} strokeWidth={HAIR} />
}

/** A row of small cells: the event log as a strip, or buckets, the last `open` of them still open, in a faint line. */
const cells = (
  x: number,
  y: number,
  n: number,
  w: number,
  { open = 0, head = false }: { open?: number; head?: boolean } = {},
) =>
  Array.from({ length: n }, (_, i) => {
    // An open cell is the same square in a faint line: dots do not hold their shape at this size.
    const isOpen = i >= n - open
    const last = head && i === n - 1
    return (
      <rect
        key={i}
        x={x + i * (w + 2)}
        y={y - 7}
        width={w}
        height={8}
        fill={last ? LINE : BG}
        stroke={isOpen ? FAINT : LINE}
        strokeWidth={HAIR}
      />
    )
  })

/**
 * A part drawn as a panel: its name and rows of what it keeps, each a label and a reading. Polar and
 * Outpost are drawn the same way, so the two read as one system.
 */
function Panel({
  x,
  y,
  w,
  h,
  name,
  rows,
}: {
  x: number
  y: number
  w: number
  h: number
  name: string
  rows: [string, ReactNode][]
}) {
  const col = x + 64
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
      {text(x + 12, y + 18, name, LINE, 8.5)}
      {rows.map(([label, reading], i) => {
        const ry = y + 46 + i * 20
        return (
          <g key={label}>
            {text(x + 12, ry, label)}
            <g transform={`translate(${col} ${ry})`}>{reading}</g>
          </g>
        )
      })}
    </g>
  )
}

function figure() {
  const top = 152,
    h = 104,
    mid = top + h / 2
  // One rhythm: the process pads its contents by PAD, parts inside it stand GAP apart, and Polar and Redis stand
  // further off, where the lines between them carry a label.
  const PAD = 24,
    GAP = 64,
    REACH = 80
  const proc0 = 40
  const app = { x: proc0 + PAD, y: top, w: 104, h }
  const igloo = { x: app.x + app.w + GAP, y: top, w: 150, h }
  const proc = {
    x: proc0,
    y: top - PAD,
    w: igloo.x + igloo.w + PAD - proc0,
    h: h + PAD * 2,
  }
  const polar = { x: proc.x + proc.w + REACH, y: top, w: 142, h }
  const redis = {
    x: igloo.x,
    y: proc.y + proc.h + 48,
    w: igloo.w,
    h: 44,
  }
  const ix = igloo.x + igloo.w / 2
  // The labels sit in the open ground between the process and Polar.
  const gap = (proc.x + proc.w + polar.x) / 2
  return (
    <>
      <rect
        x={proc.x}
        y={proc.y}
        width={proc.w}
        height={proc.h}
        fill="none"
        stroke={MID}
        strokeWidth={HAIR}
        {...DOTTED}
      />
      {text(proc.x, proc.y - 8, 'YOUR PROCESS')}

      {box(app.x, app.y, app.w, app.h, 'APP CODE', 'ingest(event)')}
      {text(app.x + 12, app.y + 46, 'customerMeter()')}
      <Panel
        {...igloo}
        name="OUTPOST"
        rows={[
          ['reducers', text(0, 0, 'Σ output_tokens', LINE)],
          ['buckets', cells(0, 0, 6, 10, { open: 2 })],
          ['checks', text(0, 0, '0 ms', LINE)],
        ]}
      />
      <Panel
        {...polar}
        name="POLAR"
        rows={[
          ['events', cells(0, 0, 8, 6, { head: true })],
          ['reducers', text(0, 0, 'Σ output_tokens', LINE)],
          ['buckets', cells(0, 0, 6, 10, { open: 2 })],
        ]}
      />
      {box(
        redis.x,
        redis.y,
        redis.w,
        redis.h,
        'REDIS',
        'yours · buckets, snapshots',
      )}

      <line
        x1={app.x + app.w}
        x2={igloo.x}
        y1={mid}
        y2={mid}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {head(igloo.x, mid, 'right')}
      {text((app.x + app.w + igloo.x) / 2, mid - 8, '0ms', DIM, 7.5, 'middle')}

      <line
        x1={igloo.x + igloo.w}
        x2={polar.x}
        y1={mid}
        y2={mid}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {head(polar.x, mid, 'right')}
      {head(igloo.x + igloo.w, mid, 'left')}
      {text(gap, mid - 8, 'RECONCILIATION', DIM, 7.5, 'middle')}

      <line
        x1={ix}
        x2={ix}
        y1={igloo.y + igloo.h}
        y2={redis.y}
        stroke={MID}
        strokeWidth={HAIR}
      />
      {head(ix, redis.y, 'down')}
      {head(ix, igloo.y + igloo.h, 'up')}
      {text(ix + 8, (proc.y + proc.h + redis.y) / 2 + 3, 'STATE')}
    </>
  )
}

export const igloo = landscape(
  'm-igloo',
  'Where Outpost sits',
  'Between your app and Polar, with its state in your Redis.',
  'Outpost between your app and Polar: your code calls it in-process, its state is in your Redis, events go up to Polar batched, and reducers and snapshots come back down.',
  figure(),
  [
    [
      'In your process',
      [
        'Outpost is part of the Polar SDK and runs in your app. Your code hands it events and asks it to check a customer’s meter, and neither call goes to Polar.',
      ],
    ],
    [
      'Your Redis',
      [
        'Its state lives in a Redis you run: the five-minute buckets, and the snapshots Polar sent. Every process of your app reads the same state, so they agree on a balance.',
      ],
    ],
    [
      'Between you and Polar',
      [
        'Events go on to Polar batched over HTTP, and Polar’s event log stays the source of truth. Back over one WebSocket come the reducers, and a snapshot whenever usage settles.',
      ],
    ],
  ],
)
