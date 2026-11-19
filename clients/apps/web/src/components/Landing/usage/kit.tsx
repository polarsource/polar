import type { CSSProperties, ReactNode } from 'react'

/**
 * The plate kit: the drawing language of the Polar flipbook's marks chapter, set for the web. Every plate is a
 * sheet of a fixed stock (it does not follow the site's theme, it is a printed object on the page), drawn in SVG
 * on its own coordinate grid and scaled to the column it sits in.
 */

export const NIGHT = '#0d0d0d'
export const SNOW = '#f3f3f1'
export const MIST = '#a1a19f'
export const E0 = '#3619cc'
export const E1 = '#4c4ee4'
export const E2 = '#6b79ea'
export const E3 = '#96a5f0'

export const STOCK = {
  night: { ground: NIGHT, ink: SNOW, dim: MIST, rule: '#262626' },
  ether: { ground: '#1c057a', ink: SNOW, dim: E3, rule: E1 },
  tint: { ground: '#c6cff6', ink: '#1c057a', dim: E0, rule: E2 },
  // the site's own light theme: white, gray-900 ink, gray-500 and gray-200
  paper: { ground: '#ffffff', ink: '#111827', dim: '#6b7280', rule: '#e5e7eb' },
  cloud: { ground: '#d9d8d4', ink: NIGHT, dim: '#6d6c68', rule: '#b5b4b0' },
} as const
export type Stock = (typeof STOCK)[keyof typeof STOCK]

/** Any ground lighter than mid-grey takes the light grain, as the flipbook's Page decides it. */
const isLight = (s: Stock) => {
  const h = s.ground
  const v =
    parseInt(h.slice(1, 3), 16) * 0.299 +
    parseInt(h.slice(3, 5), 16) * 0.587 +
    parseInt(h.slice(5, 7), 16) * 0.114
  return v / 255 > 0.55
}

/** A seeded generator, so a plate draws the same on the server and in the browser. */
export function rand(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }
}

const MONO = 'font-mono tabular-nums'
/** Mono advance, as a share of the size. */
export const CW = 0.6
/** How wide a dump is set: offset, six bytes of hex, the same six as text. */
export const dumpW = (size: number) => 33 * size * CW
const hx = (b: number) => b.toString(16).padStart(2, '0')

export const KINDS = [
  'llm.completion',
  'api.request',
  'search.query',
  'agent.tool_call',
  'embedding.create',
  'image.render',
]

export const encode = (v: unknown) =>
  Array.from(new TextEncoder().encode(JSON.stringify(v)))

/** An event's body, as the bytes that cross the wire. */
export function body(r: () => number, name: string, customer: string) {
  return encode({
    name,
    external_customer_id: customer,
    metadata: { units: Math.floor(r() ** 2 * 4000) },
    timestamp: 1762992000 + Math.floor(r() * 3600),
  })
}

export type Row = { off: string; hexs: string; text: string }

/** Rows of xxd, six bytes each, from row `from`, with offsets counted from `offset` in the stream. */
export function rowsOf(
  bytes: number[],
  from: number,
  rows: number,
  offset: number,
): Row[] {
  return Array.from({ length: rows }, (_, k) => {
    const chunk = bytes.slice((from + k) * 6, (from + k) * 6 + 6)
    return {
      off: (offset + (from + k) * 6).toString(16).padStart(6, '0'),
      hexs: chunk.map(hx).join(' ').padEnd(17, ' '),
      text: chunk
        .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
        .join(''),
    }
  })
}

/** A dump set at (x, y): an optional head line, then the rows; `inv` sets it reversed on a block of that colour. */
export function DumpText({
  x,
  y,
  size = 12,
  rows,
  ink,
  dim,
  inv,
  head,
  headInk,
}: {
  x: number
  y: number
  size?: number
  rows: Row[]
  ink: string
  dim: string
  inv?: string
  head?: string
  headInk?: string
}) {
  const cw = size * CW
  const lh = Math.round((size * 4) / 3)
  const h0 = head ? lh : 0
  return (
    <g className={MONO} fontSize={size} style={{ whiteSpace: 'pre' }}>
      {inv ? (
        <rect
          x={x - 4}
          y={y + h0 - 1}
          width={dumpW(size) + 8}
          height={rows.length * lh + 2}
          fill={inv}
        />
      ) : null}
      {head ? (
        <text x={x} y={y + lh - 4} fill={headInk ?? ink}>
          {head}
        </text>
      ) : null}
      {rows.map((ln, k) => (
        <text key={k} y={y + h0 + (k + 1) * lh - 4} fill={ink}>
          <tspan x={x} fill={dim}>
            {ln.off}
          </tspan>
          <tspan x={x + 8 * cw}>{ln.hexs}</tspan>
          <tspan x={x + 27 * cw} fill={dim}>
            {ln.text}
          </tspan>
        </text>
      ))}
    </g>
  )
}

/** A line of mono type that keeps its spaces, so columns set in it stay columns. */
export function T({
  x,
  y,
  size,
  fill,
  anchor,
  opacity,
  children,
}: {
  x: number
  y: number
  size: number
  fill: string
  anchor?: 'start' | 'middle' | 'end'
  opacity?: number
  children: ReactNode
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fill={fill}
      textAnchor={anchor}
      opacity={opacity}
      className={MONO}
      style={{ whiteSpace: 'pre' }}
    >
      {children}
    </text>
  )
}

/** Boxes already set, so no dump lands on another. */
export function placer() {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
  return (b: { x0: number; x1: number; y0: number; y1: number }) => {
    if (
      placed.some(
        (q) => q.x0 < b.x1 && b.x0 < q.x1 && q.y0 < b.y1 && b.y0 < q.y1,
      )
    )
      return false
    placed.push(b)
    return true
  }
}

/** An open arrowhead at (x, y) pointing along a. */
export const chevron = (
  x: number,
  y: number,
  a: number,
  hd: number,
  spread = 0.8,
) => {
  const p = (t: number) =>
    `${(x - hd * Math.cos(a + t)).toFixed(1)} ${(y - hd * Math.sin(a + t)).toFixed(1)}`
  return `M${p(spread)}L${x.toFixed(1)} ${y.toFixed(1)}L${p(-spread)}`
}

export const polyline = (ps: [number, number][]) =>
  'M' + ps.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')

/* ---------- newsprint ---------- */

export type Fold = 'fold' | 'thirds' | 'sixths' | 'none'

/**
 * The flipbook's Newsprint, for the web. Its multiply pass (the dull sheet, fibres and grain) is a tile laid
 * over the sheet; its creases and its screen pass are drawn here in SVG: black at a low opacity is the same as
 * multiplying, and white at a low opacity the same as screening, so they need no blend mode. A valley crease is
 * a sharp dark line with a broad shadow to one side and a little light to the other; a few short creases fade in
 * and out across the sheet.
 */
function Creases({
  w,
  h,
  fold,
  seed,
  lift,
}: {
  w: number
  h: number
  fold: Fold
  seed: string
  lift: number
}) {
  const r = rand(`news-${seed}`)
  const j = (k: number) => (r() - 0.5) * k
  // [vertical, at, strength]
  const main: [boolean, number, number][] = {
    fold: [
      [false, h / 2 + j(20), 1],
      [true, w / 2 + j(20), 0.6],
    ],
    thirds: [
      [false, (2 * h) / 3 + j(30), 1],
      [false, h / 3 + j(30), 0.85],
    ],
    sixths: [
      [false, (2 * h) / 3 + j(30), 1],
      [false, h / 3 + j(30), 0.85],
      [true, w / 2 + j(20), 0.55],
    ],
    none: [],
  }[fold] as [boolean, number, number][]
  const minor = Array.from({ length: 3 + Math.floor(r() * 3) }, () => {
    const x = r() * w,
      y = r() * h,
      a = r() * Math.PI,
      len = 120 + r() * 420
    const dx = (Math.cos(a) * len) / 2,
      dy = (Math.sin(a) * len) / 2
    return [x - dx, y - dy, x + dx, y + dy, 0.25 + r() * 0.45]
  })
  const id = `news-${seed}`
  // the broad falloff either side of a crease, as gradient stops along exp(-d / 70)
  const ramp = (c: string) =>
    [0, 0.25, 0.5, 0.75, 1].map((t) => (
      <stop key={t} offset={t} stopColor={c} stopOpacity={Math.exp(-t * 3)} />
    ))
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        {/* the shadow falls away down (or right) of a crease; the light away up (or left) of it */}
        <linearGradient id={`${id}-dn`} x1="0" y1="0" x2="0" y2="1">
          {ramp('#000')}
        </linearGradient>
        <linearGradient id={`${id}-rt`} x1="0" y1="0" x2="1" y2="0">
          {ramp('#000')}
        </linearGradient>
        <linearGradient id={`${id}-up`} x1="0" y1="1" x2="0" y2="0">
          {ramp('#fff')}
        </linearGradient>
        <linearGradient id={`${id}-lt`} x1="1" y1="0" x2="0" y2="0">
          {ramp('#fff')}
        </linearGradient>
        {minor.map((m, k) => (
          <linearGradient
            key={k}
            id={`${id}-m${k}`}
            gradientUnits="userSpaceOnUse"
            x1={m[0]}
            y1={m[1]}
            x2={m[2]}
            y2={m[3]}
          >
            <stop offset={0} stopColor="#000" stopOpacity={0} />
            <stop offset={0.5} stopColor="#000" stopOpacity={0.05 * m[4]} />
            <stop offset={1} stopColor="#000" stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      {main.map(([down, at, k], i) => {
        const span = 210
        return down ? (
          <g key={i}>
            <rect
              x={at}
              y={0}
              width={span}
              height={h}
              fill={`url(#${id}-rt)`}
              opacity={0.015 * k}
            />
            <rect
              x={at - span}
              y={0}
              width={span}
              height={h}
              fill={`url(#${id}-lt)`}
              opacity={0.011 * k}
            />
            <path
              d={`M${at} 0V${h}`}
              stroke="#000"
              strokeOpacity={0.06 * k}
              strokeWidth={2.2}
            />
            <path
              d={`M${at - 0.8} 0V${h}`}
              stroke="#fff"
              strokeOpacity={0.024 * k}
              strokeWidth={1.4}
            />
          </g>
        ) : (
          <g key={i}>
            <rect
              x={0}
              y={at}
              width={w}
              height={span}
              fill={`url(#${id}-dn)`}
              opacity={0.015 * k}
            />
            <rect
              x={0}
              y={at - span}
              width={w}
              height={span}
              fill={`url(#${id}-up)`}
              opacity={0.011 * k}
            />
            <path
              d={`M0 ${at}H${w}`}
              stroke="#000"
              strokeOpacity={0.06 * k}
              strokeWidth={2.2}
            />
            <path
              d={`M0 ${at - 0.8}H${w}`}
              stroke="#fff"
              strokeOpacity={0.024 * k}
              strokeWidth={1.4}
            />
          </g>
        )
      })}
      {minor.map((m, k) => (
        <path
          key={k}
          d={`M${m[0]} ${m[1]}L${m[2]} ${m[3]}`}
          stroke={`url(#${id}-m${k})`}
          strokeWidth={1.8}
        />
      ))}
      {/* the screen pass: black lifted a touch, as ink on newsprint never reaches black */}
      <rect width={w} height={h} fill="#fff" opacity={lift} />
    </svg>
  )
}

/**
 * A plate: the sheet, its drawing scaled to the column, and a caption set under it the way a book captions its
 * plates. `sheet` styles the sheet itself (a mask, for stationery with holes in it).
 */
export function Sheet({
  s,
  w,
  h,
  title,
  sheet,
  fold = 'thirds',
  seed = title ?? 'sheet',
  lift = 0.07,
  plain = false,
  cover = false,
  grain,
  children,
}: {
  s: Stock
  w: number
  h: number
  /** Names the plate; it seeds the folds, and is not shown. */
  title?: string
  sheet?: CSSProperties
  /** How the sheet was folded, after the flipbook's Newsprint variants. */
  fold?: Fold
  seed?: string
  /** How far the screen pass lifts black, as Newsprint's `lift`. */
  lift?: number
  /** Drawn straight on the page's own panel: no paper, grain, folds or plate caption. */
  plain?: boolean
  /** Fill whatever box it is put in, cropping the drawing like a cover image, instead of keeping its own shape. */
  cover?: boolean
  /** How strong the film grain is; the flipbook's own strength for the stock when left out. */
  grain?: number
  children: ReactNode
}) {
  if (plain)
    return (
      <figure
        className="dark:bg-polar-900 relative w-full overflow-hidden rounded-md bg-gray-50"
        style={{ aspectRatio: `${w} / ${h}`, ...sheet }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {children}
        </svg>
      </figure>
    )
  return (
    <figure
      className={`flex w-full flex-col gap-3 ${cover ? 'h-full' : ''}`}
      style={{ containerType: 'inline-size' }}
    >
      <div
        className={`relative w-full overflow-hidden ${cover ? 'h-full' : ''}`}
        style={{
          aspectRatio: cover ? undefined : `${w} / ${h}`,
          background: s.ground,
          ...sheet,
        }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio={cover ? 'xMidYMid slice' : undefined}
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {children}
        </svg>
        {/* the multiply pass: the dull sheet, its fibres and its grain, one CSS pixel to a grain, as the flipbook sets it */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-multiply"
          style={{
            backgroundImage: 'url(/assets/landing/usage/grain.png)',
            backgroundSize: '252px 256px',
          }}
        />
        <Creases w={w} h={h} fold={fold} seed={seed} lift={lift} />
        {/* the flipbook's film grain, its turbulence rasterised to a tile: screened up on dark stock, multiplied down on light */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(/assets/landing/usage/noise-${isLight(s) ? 'light' : 'dark'}.png)`,
            backgroundSize: '512px 512px',
            mixBlendMode: isLight(s) ? 'multiply' : 'screen',
            opacity: grain ?? (isLight(s) ? 0.32 : 0.16),
          }}
        />
      </div>
    </figure>
  )
}
