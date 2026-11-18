import type { CSSProperties, ReactNode } from 'react'
import { CW, E2, NIGHT, rand, Sheet, STOCK, T } from '../usage/kit'

/**
 * The stationery's tractor holes are cut through the sheet, a hole every half inch down each edge. They are
 * measured in sheet units, so they keep their size however wide the sheet is set.
 */
const holes = (w: number): CSSProperties => {
  const u = (n: number) => `${((n / w) * 100).toFixed(3)}cqw`
  const hole = (at: string) =>
    `radial-gradient(circle at ${at} ${u(25)}, transparent ${u(8.5)}, #000 ${u(9.5)})`
  const mask = `${hole(u(36))}, ${hole(`calc(100% - ${u(36)})`)}`
  return {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: `100% ${u(50)}`,
    WebkitMaskSize: `100% ${u(50)}`,
    maskRepeat: 'repeat-y',
    WebkitMaskRepeat: 'repeat-y',
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  }
}

/** Sets cells into one line of a fixed width: a cell with a column is set flush right to it. */
export const line = (...cells: [string, number?][]) => {
  let out = ''
  for (const [t, right] of cells)
    out = right === undefined ? out + t : out.padEnd(right - t.length, ' ') + t
  return out
}

/**
 * A document as a line printer gives it: continuous stationery with tractor holes down both edges and a band
 * every three lines, the rows set in mono across `cols` columns. `marks` numbers rows in the marker blue, in the
 * last two columns, for the notes beside the plate; a sheet with marks sets its rows short of them.
 */
export function Printout({
  rows,
  cols,
  w = 1150,
  marks = {},
  title,
}: {
  rows: string[]
  cols: number
  w?: number
  marks?: Record<number, number>
  title: string
}) {
  const s = STOCK.paper
  const r = rand(title)
  const x0 = 108,
    size = (w - 2 * x0) / cols / CW,
    lh = Math.round(size * 1.17),
    top = 84
  const h = top + rows.length * lh + 60
  const bands: ReactNode[] = []
  for (let k = 0; k * lh * 3 < h; k += 2)
    bands.push(
      <rect
        key={k}
        x={78}
        y={top - lh * 0.7 + k * lh * 3}
        width={w - 156}
        height={lh * 3}
        fill="#f3f4f6"
      />,
    )
  return (
    <Sheet s={s} w={w} h={h} title={title} sheet={holes(w)}>
      {bands}
      <path
        d={`M78 0V${h}M${w - 78} 0V${h}`}
        stroke={s.dim}
        strokeWidth={1}
        strokeDasharray="1 5"
      />
      {rows.map((t, k) => (
        <T
          key={k}
          x={x0}
          y={top + k * lh}
          size={size}
          fill={s.ink}
          opacity={r() < 0.12 ? 0.72 : 1}
        >
          {t}
        </T>
      ))}
      {Object.entries(marks).map(([row, n]) => {
        // the marks sit in the last two columns, which rows with marks leave empty
        const y = top + Number(row) * lh
        const m = size * 1.05
        const cx = x0 + (cols - 1) * size * CW
        return (
          <g key={row}>
            <rect
              x={cx - m / 2}
              y={y - m * 0.8}
              width={m}
              height={m}
              fill={E2}
            />
            <T
              x={cx}
              y={y - m * 0.8 + m * 0.72}
              size={m * 0.62}
              fill={NIGHT}
              anchor="middle"
            >
              {n}
            </T>
          </g>
        )
      })}
    </Sheet>
  )
}
